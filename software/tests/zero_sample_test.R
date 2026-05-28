#!/usr/bin/env Rscript
# Smoke tests for clonotype_deseq2.R and gene_deseq2.R sample reconciliation.
# Skips cleanly when DESeq2 (and its deps) aren't available locally.

if (!requireNamespace("DESeq2", quietly = TRUE) ||
    !requireNamespace("tidyr", quietly = TRUE) ||
    !requireNamespace("dplyr", quietly = TRUE) ||
    !requireNamespace("optparse", quietly = TRUE)) {
  cat("SKIP: DESeq2 (or one of optparse/tidyr/dplyr) is not installed locally; test skipped.\n")
  quit(status = 0)
}

`%||%` <- function(a, b) if (is.null(a)) b else a

SCRIPT_DIR <- (function() {
  # Try a few ways to locate this script — different shells/Rscript invocations
  # expose slightly different things.
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("--file=", args, value = TRUE)
  if (length(file_arg) > 0) {
    return(normalizePath(dirname(sub("--file=", "", file_arg[1]))))
  }
  cwd <- normalizePath(getwd())
  if (basename(cwd) == "tests") return(cwd)
  if (basename(cwd) == "software") return(normalizePath(file.path(cwd, "tests")))
  return(cwd)
})()

CLONOTYPE_SCRIPT <- normalizePath(file.path(SCRIPT_DIR, "..", "src", "deseq2-clonotype", "clonotype_deseq2.R"))
GENE_SCRIPT      <- normalizePath(file.path(SCRIPT_DIR, "..", "src", "deseq2-gene", "gene_deseq2.R"))

# --- Fixture helpers ----------------------------------------------------------

write_long_counts <- function(path, samples, ids, id_col, value_col, value_fn) {
  # Build long-format counts CSV — one row per (sample, id) with value > 0
  rows <- list()
  for (s in samples) {
    for (cl in ids) {  # cl, not c — avoid shadowing base R c()
      v <- value_fn(s, cl)
      if (v > 0) {
        rows[[length(rows) + 1L]] <- setNames(
          list(s, cl, v),
          c("Sample", id_col, value_col)
        )
      }
    }
  }
  df <- do.call(rbind, lapply(rows, as.data.frame, stringsAsFactors = FALSE, check.names = FALSE))
  if (is.null(df)) {
    # No rows — emit header only
    df <- data.frame(
      Sample = character(),
      x = character(),
      y = integer(),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
    names(df) <- c("Sample", id_col, value_col)
  }
  write.csv(df, path, row.names = FALSE)
}

write_metadata <- function(path, samples, groups) {
  m <- data.frame(Sample = samples, Group = groups,
                  check.names = FALSE, stringsAsFactors = FALSE)
  write.csv(m, path, row.names = FALSE)
}

run_clonotype <- function(wd) {
  cmd <- sprintf(
    "cd %s && Rscript %s -c rawCounts.csv -m covariates.csv -t Group -n A -d B -o topTable.csv --IDs_column 'Clonotype key' --values_column 'Number of UMIs' --min_counts 1 --fraction_for_filter 0.01 2>&1",
    shQuote(wd), shQuote(CLONOTYPE_SCRIPT)
  )
  out <- suppressWarnings(system(cmd, intern = TRUE))
  list(status = attr(out, "status") %||% 0, output = paste(out, collapse = "\n"))
}

run_gene <- function(wd) {
  cmd <- sprintf(
    "cd %s && Rscript %s -c rawCounts.csv -m covariates.csv -t Group -n A -d B -o topTable.csv --IDs_column 'Ensembl Id' -s test-species 2>&1",
    shQuote(wd), shQuote(GENE_SCRIPT)
  )
  out <- suppressWarnings(system(cmd, intern = TRUE))
  list(status = attr(out, "status") %||% 0, output = paste(out, collapse = "\n"))
}

assert_pass <- function(name, cond, msg = "") {
  if (!isTRUE(cond)) {
    cat(sprintf("FAIL [%s]: %s\n", name, msg))
    quit(status = 1)
  }
}

# --- Scenario 1: clonotype, drop a sample but groups stay ≥2 ------------------
# Why: covers the happy path of the reconciliation — the previously crashing
# case (sample in metadata, absent from counts) now succeeds because the empty
# sample is dropped and the remaining group sizes still satisfy DESeq2.
cat("\n=== Scenario 1: clonotype, drop one sample, groups still ≥ 2 ===\n")
wd1 <- tempfile("dca-clonotype-drop-")
dir.create(wd1)
write_long_counts(
  file.path(wd1, "rawCounts.csv"),
  samples = c("S1", "S2", "S4", "S5", "S6"),  # S3 absent from counts
  ids = c("c1", "c2", "c3", "c4", "c5"),
  id_col = "Clonotype key",
  value_col = "Number of UMIs",
  value_fn = function(s, cl) {
    base <- switch(s, "S1" = 10, "S2" = 50, "S4" = 30, "S5" = 22, "S6" = 41)
    base + nchar(cl)
  }
)
# Metadata lists 6 samples; groups A=3 (S1,S2,S3), B=3 (S4,S5,S6).
# Dropping S3 leaves A=2, B=3 — analysis still viable.
write_metadata(
  file.path(wd1, "covariates.csv"),
  samples = c("S1", "S2", "S3", "S4", "S5", "S6"),
  groups  = c("A",  "A",  "A",  "B",  "B",  "B")
)
res1 <- run_clonotype(wd1)
cat(res1$output, "\n")
assert_pass("S1-exit", res1$status == 0,
            sprintf("clonotype run exited %d, expected 0", res1$status))
assert_pass("S1-warn", grepl("no count rows", res1$output, fixed = TRUE),
            "expected 'no count rows' warning not found")
assert_pass("S1-warn-names-sample", grepl("S3", res1$output, fixed = TRUE),
            "warning text should name the dropped sample 'S3'")
assert_pass("S1-toptable", file.exists(file.path(wd1, "topTable.csv")),
            "topTable.csv should have been produced")
cat("PASS: Scenario 1 — clonotype drop, groups still viable\n")

# --- Scenario 2: clonotype, baseline (no drops) -------------------------------
# Why: false-positive guard — the warning must not fire when all samples have
# counts. Catches regressions where the reconciliation gets too aggressive.
cat("\n=== Scenario 2: clonotype, baseline (no drops) ===\n")
wd2 <- tempfile("dca-clonotype-baseline-")
dir.create(wd2)
write_long_counts(
  file.path(wd2, "rawCounts.csv"),
  samples = c("S1", "S2", "S3", "S4"),
  ids = c("c1", "c2", "c3", "c4", "c5"),
  id_col = "Clonotype key",
  value_col = "Number of UMIs",
  value_fn = function(s, cl) {
    base <- switch(s, "S1" = 10, "S2" = 50, "S3" = 12, "S4" = 30)
    base + nchar(cl)
  }
)
write_metadata(
  file.path(wd2, "covariates.csv"),
  samples = c("S1", "S2", "S3", "S4"),
  groups  = c("A",  "B",  "A",  "B")
)
res2 <- run_clonotype(wd2)
cat(res2$output, "\n")
assert_pass("S2-exit", res2$status == 0,
            sprintf("baseline run exited %d, expected 0", res2$status))
assert_pass("S2-no-warn", !grepl("no count rows", res2$output, fixed = TRUE),
            "baseline must not emit 'no count rows' warning")
assert_pass("S2-toptable", file.exists(file.path(wd2, "topTable.csv")),
            "baseline must produce topTable.csv")
cat("PASS: Scenario 2 — clonotype baseline, no false-positive warning\n")

# --- Scenario 3: clonotype, dropping makes group too small --------------------
# Why: dropping an empty sample can leave a contrast group with <2 replicates.
# The new guard must stop with a clear, group-specific error before DESeq2
# fails with its opaque stopifnot message.
cat("\n=== Scenario 3: clonotype, dropping leaves group with <2 replicates ===\n")
wd3 <- tempfile("dca-clonotype-toosmall-")
dir.create(wd3)
write_long_counts(
  file.path(wd3, "rawCounts.csv"),
  samples = c("S1", "S2", "S4"),  # S3 absent — and S3 is in group A
  ids = c("c1", "c2", "c3", "c4", "c5"),
  id_col = "Clonotype key",
  value_col = "Number of UMIs",
  value_fn = function(s, cl) {
    base <- switch(s, "S1" = 10, "S2" = 50, "S4" = 30)
    base + nchar(cl)
  }
)
# A has S1, S3 (S3 absent → A drops to 1). B has S2, S4 (both present, =2).
write_metadata(
  file.path(wd3, "covariates.csv"),
  samples = c("S1", "S2", "S3", "S4"),
  groups  = c("A",  "B",  "A",  "B")
)
res3 <- run_clonotype(wd3)
cat(res3$output, "\n")
assert_pass("S3-exit", res3$status != 0,
            "expected non-zero exit when group too small")
assert_pass("S3-msg", grepl("at least 2 are required", res3$output, fixed = TRUE),
            "expected actionable 'at least 2 are required' message")
assert_pass("S3-msg-names-group", grepl("group 'A'", res3$output, fixed = TRUE),
            "error should name the undersized group 'A'")
assert_pass("S3-no-toptable", !file.exists(file.path(wd3, "topTable.csv")),
            "topTable.csv must NOT be produced when guard fires")
cat("PASS: Scenario 3 — group-too-small guard fires with clear message\n")

# --- Scenario 4: gene_deseq2.R covers the same reconciliation -----------------
# Why: gene_deseq2.R applies the identical fix to the RNA-seq path. Without
# this scenario, gene-script regressions slip through.
cat("\n=== Scenario 4: gene, drop one sample, groups still ≥ 2 ===\n")
wd4 <- tempfile("dca-gene-drop-")
dir.create(wd4)
write_long_counts(
  file.path(wd4, "rawCounts.csv"),
  samples = c("S1", "S2", "S4", "S5", "S6"),  # S3 absent
  ids = c("g1", "g2", "g3", "g4", "g5"),
  id_col = "Ensembl Id",
  value_col = "Raw gene expression",
  value_fn = function(s, cl) {
    base <- switch(s, "S1" = 100, "S2" = 200, "S4" = 150, "S5" = 180, "S6" = 220)
    base + nchar(cl) * 10
  }
)
write_metadata(
  file.path(wd4, "covariates.csv"),
  samples = c("S1", "S2", "S3", "S4", "S5", "S6"),
  groups  = c("A",  "A",  "A",  "B",  "B",  "B")
)
res4 <- run_gene(wd4)
cat(res4$output, "\n")
assert_pass("S4-exit", res4$status == 0,
            sprintf("gene run exited %d, expected 0", res4$status))
assert_pass("S4-warn", grepl("no count rows", res4$output, fixed = TRUE),
            "expected 'no count rows' warning in gene script too")
assert_pass("S4-warn-names-sample", grepl("S3", res4$output, fixed = TRUE),
            "gene warning should name the dropped sample 'S3'")
assert_pass("S4-toptable", file.exists(file.path(wd4, "topTable.csv")),
            "gene script should produce topTable.csv")
cat("PASS: Scenario 4 — gene script drop, groups still viable\n")

cat("\nAll scenarios passed.\n")
