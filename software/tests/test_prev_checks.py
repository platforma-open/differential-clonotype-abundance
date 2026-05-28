"""Behavioral tests for prevChecks.py.

Invokes the script as a subprocess (the script lives in `src/prev-checks/`,
a directory whose name contains a hyphen — not importable as a Python
package). Each test constructs synthetic metadata + counts CSVs in a
`tmp_path`, runs the script, and asserts on the four output files
(continueOrNot.txt, errorLogs.csv, excludedSamples.csv,
filteredCovariates.csv).

Run from `software/`:
    uv sync
    uv run pytest tests/
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pandas as pd

SCRIPT = Path(__file__).resolve().parent.parent / "src" / "prev-checks" / "prevChecks.py"


# --------------------------------------------------------------------------- #
# Fixtures / helpers                                                          #
# --------------------------------------------------------------------------- #


def _run_script(
    workdir: Path,
    metadata: pd.DataFrame,
    counts: pd.DataFrame,
    contrast_factor: str,
    numerators: list[str],
    denominator: str,
) -> dict:
    """Run prevChecks.py with the given inputs and collect all four outputs."""
    metadata_path = workdir / "covariates.csv"
    counts_path = workdir / "rawCounts.csv"
    metadata.to_csv(metadata_path, index=False)
    counts.to_csv(counts_path, index=False)

    error_path = workdir / "errorLogs.csv"
    excluded_path = workdir / "excludedSamples.csv"
    filtered_path = workdir / "filteredCovariates.csv"

    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--metadata",
            str(metadata_path),
            "--counts",
            str(counts_path),
            "--output",
            str(workdir),
            "--contrast_factor",
            contrast_factor,
            "--numerators",
            json.dumps(numerators),
            "--denominator",
            denominator,
            "--error_output",
            str(error_path),
            "--excluded_samples_output",
            str(excluded_path),
            "--filtered_covariates_output",
            str(filtered_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )

    continue_or_not = (workdir / "continueOrNot.txt").read_text().strip()
    return {
        "stdout": proc.stdout,
        "stderr": proc.stderr,
        "continue_or_not": continue_or_not,
        "errors": pd.read_csv(error_path) if error_path.exists() else pd.DataFrame(),
        "excluded": pd.read_csv(excluded_path) if excluded_path.exists() else pd.DataFrame(),
        "filtered_meta": pd.read_csv(filtered_path) if filtered_path.exists() else pd.DataFrame(),
    }


def _metadata(samples: list[str], groups: list[str], **extra: list) -> pd.DataFrame:
    """Build a minimal metadata table — Sample + Group, plus optional extras."""
    return pd.DataFrame({"Sample": samples, "Group": groups, **extra})


def _counts(samples: list[str], n_per_sample: int = 3) -> pd.DataFrame:
    """Long-format counts: n_per_sample rows per sample, varied values."""
    rows = [
        {"Sample": s, "Clonotype key": f"c{i}", "Number of UMIs": 10 + i}
        for s in samples
        for i in range(n_per_sample)
    ]
    return pd.DataFrame(rows, columns=["Sample", "Clonotype key", "Number of UMIs"])


# --------------------------------------------------------------------------- #
# Behavioral tests                                                            #
# --------------------------------------------------------------------------- #


class TestNoSamplesDropped:
    """Baseline path — every metadata sample has counts."""

    # If reconciliation gets too aggressive, every healthy block run fails —
    # this guard catches that regression.
    def test_continues_when_all_samples_present(self, tmp_path):
        meta = _metadata(["S1", "S2", "S3", "S4"], ["A", "B", "A", "B"])
        counts = _counts(["S1", "S2", "S3", "S4"])

        res = _run_script(tmp_path, meta, counts, "Group", ["A"], "B")

        assert res["continue_or_not"] == "continue"
        assert len(res["excluded"]) == 0
        assert list(res["excluded"].columns) == ["Sample", "reason"]
        # Filtered covariates should match input one-for-one
        assert set(res["filtered_meta"]["Sample"]) == {"S1", "S2", "S3", "S4"}
        # No warnings emitted
        assert len(res["errors"]) == 0
        assert list(res["errors"].columns) == ["Error", "value"]


class TestOneSampleDropped:
    """One metadata sample absent from counts; groups remain viable."""

    # Confirms the symmetric reconciliation excludes the right sample, emits
    # one warning per dropped sample, and names the sample in the reason text
    # (so the UI's getUniqueValues call doesn't collapse multiple drops to one).
    def test_reports_dropped_sample(self, tmp_path):
        meta = _metadata(
            ["S1", "S2", "S3", "S4", "S5", "S6"],
            ["A", "A", "A", "B", "B", "B"],
        )
        counts = _counts(["S1", "S2", "S4", "S5", "S6"])  # S3 absent

        res = _run_script(tmp_path, meta, counts, "Group", ["A"], "B")

        assert res["continue_or_not"] == "continue"
        assert list(res["excluded"]["Sample"]) == ["S3"]
        assert "S3" in res["excluded"]["reason"].iloc[0]
        assert set(res["filtered_meta"]["Sample"]) == {"S1", "S2", "S4", "S5", "S6"}
        # Filtered covariates preserves Group column values
        assert set(res["filtered_meta"]["Group"]) == {"A", "B"}
        # One per-sample warning, no group warnings (groups still ≥ 2)
        assert len(res["errors"]) == 1
        assert "S3" in res["errors"]["value"].iloc[0]

    # Two samples missing from the same group, but the group still has ≥2
    # replicates — both should be listed in excludedSamples with distinct
    # reason text (sample name in each row).
    def test_two_samples_dropped_listed_separately(self, tmp_path):
        meta = _metadata(
            ["S1", "S2", "S3", "S4", "S5", "S6", "S7"],
            ["A", "A", "A", "A", "A", "B", "B"],
        )
        # Drop S3 and S5; group A still has 3 (S1, S2, S4), B has 2
        counts = _counts(["S1", "S2", "S4", "S6", "S7"])

        res = _run_script(tmp_path, meta, counts, "Group", ["A"], "B")

        assert res["continue_or_not"] == "continue"
        assert set(res["excluded"]["Sample"]) == {"S3", "S5"}
        # Each row's reason text contains its own sample name
        for _, row in res["excluded"].iterrows():
            assert row["Sample"] in row["reason"]


class TestGroupTooSmall:
    """Dropping the empty sample leaves a contrast group with <2 replicates."""

    # Guards against shipping a config that DESeq2 would reject — but with a
    # clearer, group-specific message that names the actual problem so the
    # user can fix their sample selection rather than reading R stack traces.
    def test_stops_with_actionable_message(self, tmp_path):
        meta = _metadata(["S1", "S2", "S3", "S4"], ["A", "B", "A", "B"])
        counts = _counts(["S1", "S2", "S4"])  # S3 absent → A drops to 1

        res = _run_script(tmp_path, meta, counts, "Group", ["A"], "B")

        assert res["continue_or_not"] == "stop"
        # Two errorLogs entries: per-sample warning + group-size warning
        assert len(res["errors"]) == 2
        assert any("S3" in v for v in res["errors"]["value"])
        assert any("'A'" in v and "at least 2 are required" in v for v in res["errors"]["value"])
        assert list(res["excluded"]["Sample"]) == ["S3"]


class TestRankDeficientDesign:
    """When filtered metadata has a non-full-rank design, stop with rank warning."""

    # Group and Subgroup are perfectly collinear (every A is X, every B is Y),
    # so the design matrix is rank-deficient. The rank check should fire even
    # though no samples were dropped.
    def test_stops_on_rank_deficient(self, tmp_path):
        meta = _metadata(
            ["S1", "S2", "S3", "S4"],
            ["A", "B", "A", "B"],
            Subgroup=["X", "Y", "X", "Y"],
        )
        counts = _counts(["S1", "S2", "S3", "S4"])

        res = _run_script(tmp_path, meta, counts, "Group", ["A"], "B")

        assert res["continue_or_not"] == "stop"
        assert any("not full rank" in v for v in res["errors"]["value"])
        assert len(res["excluded"]) == 0


class TestEmptyCounts:
    """Edge case: counts CSV has the header only — no data rows."""

    # Surfaces a real downstream scenario (every upstream sample produced
    # zero rows). All metadata samples should be excluded; both groups go
    # to zero replicates → stop with per-group warnings.
    def test_excludes_all_samples_and_stops(self, tmp_path):
        meta = _metadata(["S1", "S2", "S3", "S4"], ["A", "B", "A", "B"])
        counts = pd.DataFrame(columns=["Sample", "Clonotype key", "Number of UMIs"])

        res = _run_script(tmp_path, meta, counts, "Group", ["A"], "B")

        assert res["continue_or_not"] == "stop"
        assert set(res["excluded"]["Sample"]) == {"S1", "S2", "S3", "S4"}
        # 4 per-sample warnings + at least 2 group warnings (A, B both empty)
        assert len(res["errors"]) >= 4
        assert any("'A'" in v and "0 sample(s)" in v for v in res["errors"]["value"])
        assert any("'B'" in v and "0 sample(s)" in v for v in res["errors"]["value"])
        # Filtered covariates is empty
        assert len(res["filtered_meta"]) == 0


class TestMultipleNumerators:
    """Multiple numerators in one run — replicate check applies to each level."""

    # The block lets users pick multiple numerators against one denominator.
    # Each numerator level must have ≥2 replicates independently — if even
    # one fails, the whole run stops.
    def test_one_undersized_numerator_triggers_stop(self, tmp_path):
        meta = _metadata(
            ["S1", "S2", "S3", "S4", "S5"],
            ["A", "A", "B", "B", "C"],  # C has only 1 replicate
        )
        counts = _counts(["S1", "S2", "S3", "S4", "S5"])

        # User asks: A vs B (ok) AND C vs B (C undersized)
        res = _run_script(tmp_path, meta, counts, "Group", ["A", "C"], "B")

        assert res["continue_or_not"] == "stop"
        assert any("'C'" in v and "at least 2 are required" in v for v in res["errors"]["value"])


class TestContrastFactorMissing:
    """The Tengo workflow passes the contrast-factor label from the PColumn
    spec, which is normally a column header in the metadata CSV. If the label
    doesn't match (misconfiguration), the script must stop with a clear,
    pointed error — not silently fall through to a misleading rank-deficiency
    message downstream."""

    # Without this guard, rank check ran instead and produced a confusing
    # "not full rank" warning that didn't name the actual problem.
    def test_stops_with_named_contrast_factor_error(self, tmp_path):
        # Metadata has Group + Batch, but workflow asks for "Treatment"
        meta = pd.DataFrame(
            {
                "Sample": ["S1", "S2", "S3", "S4"],
                "Group": ["A", "B", "A", "B"],
                "Batch": ["b1", "b2", "b1", "b2"],
            }
        )
        counts = _counts(["S1", "S2", "S3", "S4"])

        res = _run_script(tmp_path, meta, counts, "Treatment", ["A"], "B")

        assert res["continue_or_not"] == "stop"
        assert any("Treatment" in v and "not found" in v for v in res["errors"]["value"])


class TestOutputFileShape:
    """Both auxiliary outputs must always exist with the expected columns,
    even on the happy path. Schema stability matters for the downstream
    PColumn import — a missing column would crash the workflow."""

    # excludedSamples.csv and errorLogs.csv must have their header rows even
    # when they contain no data — the workflow's xsv.importFile would fail
    # otherwise.
    def test_schemas_present_even_when_empty(self, tmp_path):
        meta = _metadata(["S1", "S2"], ["A", "B"])
        counts = _counts(["S1", "S2"])

        res = _run_script(tmp_path, meta, counts, "Group", ["A"], "B")

        # Schemas
        assert list(res["excluded"].columns) == ["Sample", "reason"]
        assert list(res["errors"].columns) == ["Error", "value"]
        # filteredCovariates preserves the input metadata columns
        assert "Sample" in res["filtered_meta"].columns
        assert "Group" in res["filtered_meta"].columns

    # Without explicit dtype, pandas coerces numeric sample IDs to int,
    # breaking string-comparison with axis keys downstream. Verify they
    # round-trip as strings.
    def test_numeric_sample_ids_stay_strings(self, tmp_path):
        meta = _metadata(["123", "456", "789", "012"], ["A", "B", "A", "B"])
        counts = _counts(["123", "456", "789", "012"])

        res = _run_script(tmp_path, meta, counts, "Group", ["A"], "B")

        assert res["continue_or_not"] == "continue"
        # Pandas may read these IDs as ints in the test, but the script treats
        # them as strings for set membership: no samples reported as dropped.
        assert len(res["excluded"]) == 0

    # Manual invocations may place outputs in a fresh directory subtree;
    # the script must auto-create the parents. Regression guard for
    # _ensure_parent_dir().
    def test_creates_missing_output_directories(self, tmp_path):
        meta = _metadata(["S1", "S2"], ["A", "B"])
        counts = _counts(["S1", "S2"])

        meta.to_csv(tmp_path / "covariates.csv", index=False)
        counts.to_csv(tmp_path / "rawCounts.csv", index=False)

        # Outputs land in subdirs that don't exist yet
        outdir = tmp_path / "nested" / "outputs"

        subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--metadata",
                str(tmp_path / "covariates.csv"),
                "--counts",
                str(tmp_path / "rawCounts.csv"),
                "--output",
                str(outdir),
                "--contrast_factor",
                "Group",
                "--numerators",
                json.dumps(["A"]),
                "--denominator",
                "B",
                "--error_output",
                str(outdir / "errorLogs.csv"),
                "--excluded_samples_output",
                str(outdir / "excludedSamples.csv"),
                "--filtered_covariates_output",
                str(outdir / "filteredCovariates.csv"),
            ],
            check=True,
        )

        # All four outputs landed in the previously-nonexistent directory
        assert (outdir / "continueOrNot.txt").exists()
        assert (outdir / "errorLogs.csv").exists()
        assert (outdir / "excludedSamples.csv").exists()
        assert (outdir / "filteredCovariates.csv").exists()
