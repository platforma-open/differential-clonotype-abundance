import argparse
import json
import os

import numpy as np
import pandas as pd
from patsy import dmatrix


def is_full_rank(design_df, formula):
    """Checks if the model matrix from the design dataframe is full rank."""
    try:
        model_matrix = np.asarray(dmatrix(formula, design_df, return_type="dataframe"))
        rank = np.linalg.matrix_rank(model_matrix)
        return rank == model_matrix.shape[1]
    except Exception as e:
        print(f"Error in model matrix computation: {e}")
        return False


def export_result(content, output_dir, filename="continueOrNot.txt"):
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, filename)
    with open(output_path, "w") as f:
        f.write(content)


def _ensure_parent_dir(path):
    """Make sure the directory containing `path` exists.

    The workflow always writes to the current working directory. A manual
    invocation with a path in a fresh directory tree would crash the to_csv
    calls below with FileNotFoundError.
    """
    parent = os.path.dirname(path) or "."
    os.makedirs(parent, exist_ok=True)


def main():
    parser = argparse.ArgumentParser(
        description="Previous data checks before starting differential analysis."
    )
    parser.add_argument("--metadata", type=str, required=True, help="Path to metadata CSV file")
    parser.add_argument(
        "--counts",
        type=str,
        required=True,
        help="Path to counts CSV (long format with Sample column)",
    )
    parser.add_argument("--output", type=str, required=True, help="Output directory")
    parser.add_argument("--contrast_factor", type=str, required=True, help="Contrast factor")
    parser.add_argument("--numerators", required=True, help="Numerators")
    parser.add_argument("--denominator", type=str, required=True, help="Denominator")
    parser.add_argument("--error_output", type=str, required=True, help="Error log CSV output path")
    parser.add_argument(
        "--excluded_samples_output",
        type=str,
        required=True,
        help="Excluded samples CSV output path",
    )
    parser.add_argument(
        "--filtered_covariates_output",
        type=str,
        required=True,
        help="Filtered covariates CSV output path",
    )
    args = parser.parse_args()

    numerators = json.loads(args.numerators)

    # Load metadata
    metadata = pd.read_csv(args.metadata, dtype=str)
    metadata.set_index(keys="Sample", inplace=True)

    # Read only the Sample column from counts — cheap even for huge files.
    # Materialise as a set so the membership checks below are O(1) instead of
    # O(len(counts_samples)) per metadata sample.
    counts_samples = set(pd.read_csv(args.counts, usecols=["Sample"], dtype=str)["Sample"].unique())

    metadata_samples = list(metadata.index)
    dropped = [s for s in metadata_samples if s not in counts_samples]

    errorLogs = []
    excluded_rows = []

    for s in dropped:
        # Include the sample name in the reason so the UI's getUniqueValues
        # call (which deduplicates) still yields one entry per excluded sample.
        excluded_rows.append({"Sample": s, "reason": f"Sample '{s}' has no abundance counts"})
        errorLogs.append(
            f"Warning: Sample '{s}' has no abundance counts and was excluded from the analysis."
        )

    filtered_metadata = metadata.loc[[s for s in metadata_samples if s in counts_samples]]

    # Replicate-count check on the FILTERED metadata
    contrast_levels = [str(n) for n in numerators] + [str(args.denominator)]
    insufficient = False
    if args.contrast_factor not in filtered_metadata.columns:
        # Misconfiguration: the label passed via --contrast_factor doesn't
        # match any column in metadata. Surface this directly instead of
        # letting the rank check produce a misleading downstream error.
        errorLogs.append(
            f"Error: Contrast factor '{args.contrast_factor}' not found in metadata columns."
        )
        insufficient = True
    else:
        value_counts = filtered_metadata[args.contrast_factor].value_counts()
        for level in contrast_levels:
            n = int(value_counts.get(level, 0))
            if n < 2:
                errorLogs.append(
                    f"Warning: Group '{level}' has {n} sample(s) after dropping samples without counts; at least 2 are required."
                )
                insufficient = True

    if insufficient:
        export_result("stop", args.output)
    else:
        # Rename columns to numbers so patsy doesn't choke on punctuation
        # or whitespace in metadata column names.
        rank_metadata = filtered_metadata.copy()
        rank_metadata.columns = [f"c{i}" for i in range(len(rank_metadata.columns))]
        formula = "~" + " + ".join(rank_metadata.columns)
        if is_full_rank(rank_metadata, formula):
            export_result("continue", args.output)
        else:
            errorLogs.append(
                "Warning: The model matrix is not full rank, so the model cannot be fit as specified. "
                "One or more variables or interaction terms in the design formula are linear "
                "combinations of the others and must be removed. Please, check the metadata "
                "columns included in the Design section."
            )
            export_result("stop", args.output)

    _ensure_parent_dir(args.error_output)
    df_error = pd.DataFrame({"Error": range(len(errorLogs)), "value": errorLogs})
    df_error.to_csv(args.error_output, index=False)

    # Write excluded samples CSV — always exists, even if empty
    _ensure_parent_dir(args.excluded_samples_output)
    df_excluded = pd.DataFrame(excluded_rows, columns=["Sample", "reason"])
    df_excluded.to_csv(args.excluded_samples_output, index=False)

    # Write filtered covariates CSV (with Sample as a column, matching input format)
    _ensure_parent_dir(args.filtered_covariates_output)
    filtered_metadata.reset_index().to_csv(args.filtered_covariates_output, index=False)


if __name__ == "__main__":
    main()
