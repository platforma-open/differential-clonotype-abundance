#!/usr/bin/env Rscript

# Load libraries
suppressMessages(library("optparse"))
suppressMessages(library("tidyr"))
suppressMessages(library("dplyr"))
suppressMessages(library("DESeq2"))


# DESeq2 script using above declared functions
option_list <- list(
  make_option(c("-c", "--count_matrix"), type = "character", default = NULL,
              help = "Path to count matrix CSV file", metavar = "character"),
  make_option(c("-m", "--metadata"), type = "character", default = NULL,
              help = "Path to metadata CSV file", metavar = "character"),
  make_option(c("-t", "--contrast_factor"), type = "character", default = NULL,
              help = "Column name in metadata for the contrast",
              metavar = "character"),
  make_option(c("-n", "--numerator"), type = "character", default = NULL,
              help = "Numerator level for contrast factor",
              metavar = "character"),
  make_option(c("-d", "--denominator"), type = "character", default = NULL,
              help = "Denominator level for contrast factor",
              metavar = "character"),
  make_option(c("-o", "--output"), type = "character",
              default = "deseq2_results.csv",
              help = "Output CSV file for results", metavar = "character"),
  make_option(c("-f", "--fc_threshold"), type = "double", default = 1,
              help = "Adjusted p-value threshold for significance"),
  make_option(c("-p", "--p_threshold"), type = "double", default = 0.05,
              help = "Adjusted p-value threshold for significance"),
  make_option(c("-v", "--values_column"), type = "character", 
              default = "Number of UMIs",
              help = "Name of column containing counts"),
  make_option(c("-i", "--IDs_column"), type = "character",
              default = "Clonotype key",
              help = "Name of column containing gene/clonotype IDs"),
  make_option(c("-x", "--min_counts"), type = "double", default = 5,
              help = "minimum number of counts in fraction of samples defined by fraction_for_filter"),
  make_option(c("-y", "--fraction_for_filter"), type = "double", default = 0.9,
              help = "Fraction of samples that should have more than X min_counts to be accepted in analysis")
)

opt_parser <- OptionParser(option_list = option_list)
opt <- parse_args(opt_parser)

if (is.null(opt$count_matrix) || is.null(opt$metadata) || is.null(opt$contrast_factor) || is.null(opt$numerator) || is.null(opt$denominator)) {
  stop("Missing required arguments")
}

# Load count matrix and covariates metadata
count_long <- read.csv(opt$count_matrix, check.names = FALSE)
metadata <- read.csv(opt$metadata, row.names = 1, check.names = FALSE)

# Rename some input variables
values_col <- opt$values_column
ids_col <- opt$IDs_column
min_counts <- opt$min_counts
filter_fraction <- opt$fraction_for_filter

# Validate contrast factor
if (!opt$contrast_factor %in% colnames(metadata)) {
  stop("Contrast factor column not found in metadata")
}
if (!(opt$numerator %in% metadata[[opt$contrast_factor]])) {
  stop("Numerator not found in contrast factor column")
}
if (!(opt$denominator %in% metadata[[opt$contrast_factor]])) {
  stop("Denominator not found in contrast factor column")
}

colnames(metadata) <- make.names(colnames(metadata))

# Transform long format to wide format
count_matrix <- count_long %>%
  pivot_wider(names_from = Sample, values_from = values_col) %>%
  as.data.frame()

# Set Id columns as row name and remove it
rownames(count_matrix) <- count_matrix[, ids_col]
count_matrix <- count_matrix[, -1]

# Convert NA values to zero
count_matrix[is.na(count_matrix)] <- 0

# Apply filter by low counts (at least filter by values in one sample)
min_samples <- max(floor(ncol(count_matrix) * filter_fraction), 1)
count_matrix <- count_matrix[rowSums(count_matrix >= min_counts) >= min_samples, ]

# Prepare DESeq2 dataset
dds <- DESeqDataSetFromMatrix(
  countData = count_matrix,
  colData = metadata,
  design = as.formula(paste("~", paste(colnames(metadata), collapse = " + ")))
)
dds <- DESeq(dds, fitType = "local")


# Extract topTable
res <- results(dds, contrast = c(make.names(opt$contrast_factor), opt$numerator, opt$denominator))
res_df <- as.data.frame(res)

# Tidy table
res_df[ids_col] <- rownames(res_df)
res_df$minlog10padj <- -log10(res_df$padj)
res_df$minlog10padj[is.na(res_df$minlog10padj)] <- NA

# Add regulation direction
res_df$Regulation <- ifelse(res_df$log2FoldChange >= opt$fc_threshold, "Up",
                            ifelse(res_df$log2FoldChange <= -opt$fc_threshold,
                                   "Down", "NS"))

# Reorder columns
res_df <- res_df[, c(ids_col, "Regulation",
                     setdiff(colnames(res_df), c(ids_col, 
                                                 "Regulation")))]

# Save topTable as csv
write.csv(res_df, opt$output, row.names = FALSE)
cat("Full results saved to", opt$output, "\n")


# Filter DEGs with adjusted p-value < p_threshold and absolute log2FoldChange > fc_threshold
deg_df <- res_df[
  res_df$padj <= opt$p_threshold & abs(res_df$log2FoldChange) >= opt$fc_threshold,
  c(ids_col, "log2FoldChange", "Regulation")
]
# Filter out counts without ID
deg_df <- deg_df[!is.na(deg_df[ids_col]),]

# Save DEC as csv
write.csv(deg_df, "DEG.csv", row.names = FALSE)
cat("Filtered DEGs saved to", "DEG.csv", "\n")