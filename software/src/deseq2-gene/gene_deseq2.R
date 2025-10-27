#!/usr/bin/env Rscript

# Load libraries
suppressMessages(library("optparse"))
suppressMessages(library("tidyr"))
suppressMessages(library("dplyr"))
suppressMessages(library("DESeq2"))
suppressMessages(library("AnnotationDbi"))

# Function to load species specific annotation package
load_annotation_package <- function(species) {
  species_to_package <- list(
    "homo-sapiens" = "org.Hs.eg.db",
    "mus-musculus" = "org.Mm.eg.db",
    "rattus-norvegicus" = "org.Rn.eg.db",
    "danio-rerio" = "org.Dr.eg.db",
    "drosophila-melanogaster" = "org.Dm.eg.db",
    "arabidopsis-thaliana" = "org.At.tair.db",
    "saccharomyces-cerevisiae" = "org.Sc.sgd.db",
    "caenorhabditis-elegans" = "org.Ce.eg.db",
    "gallus-gallus" = "org.Gg.eg.db",
    "bos-taurus" = "org.Bt.eg.db",
    "sus-scrofa" = "org.Ss.eg.db",
    "test-species" = "org.Mm.eg.db"
  )

  if (!(species %in% names(species_to_package))) {
    stop(
      "Unsupported species name. Supported species are: ",
      paste(names(species_to_package), collapse = ", ")
    )
  }

  annotation_package <- species_to_package[[species]]

  suppressMessages(library(annotation_package, character.only = TRUE))
  return(annotation_package)
}

# Function to annotate genes
annotate_results <- function(res_df, species) {
  annotation_package <- load_annotation_package(species)

  # Strip version numbers from Ensembl IDs
  rownames(res_df) <- sub("\\.\\d+$", "", rownames(res_df))
  ensembl_ids <- rownames(res_df)

  # Get all valid Ensembl IDs
  valid_ensembl_ids <- keys(get(annotation_package), keytype = "ENSEMBL")

  # Filter Ensembl IDs
  matched_ids <- ensembl_ids[ensembl_ids %in% valid_ensembl_ids]

  # Determine column to map based on species
  if (species == "saccharomyces-cerevisiae") {
    column_to_map <- "COMMON"
    key_type <- "ENSEMBL"
  } else if (species == "arabidopsis-thaliana") {
    column_to_map <- "SYMBOL"
    key_type <- "TAIR"
  } else {
    column_to_map <- "SYMBOL"
    key_type <- "ENSEMBL"
  }

  # Map IDs to symbols
  matched_symbols <- mapIds(
    get(annotation_package),
    keys = matched_ids,
    column = column_to_map,
    keytype = key_type,
    multiVals = "first"
  )

  # Create symbol column for the results
  res_df$SYMBOL <- sapply(ensembl_ids, function(id) {
    if (id %in% names(matched_symbols)) {
      return(matched_symbols[[id]])
    } else {
      return(NA)
    }
  })

  return(res_df)
}

# DESeq2 script using above declared functions
option_list <- list(
  make_option(c("-c", "--count_matrix"),
    type = "character", default = NULL,
    help = "Path to count matrix CSV file", metavar = "character"
  ),
  make_option(c("-m", "--metadata"),
    type = "character", default = NULL,
    help = "Path to metadata CSV file", metavar = "character"
  ),
  make_option(c("-t", "--contrast_factor"),
    type = "character", default = NULL,
    help = "Column name in metadata for the contrast",
    metavar = "character"
  ),
  make_option(c("-n", "--numerator"),
    type = "character", default = NULL,
    help = "Numerator level for contrast factor",
    metavar = "character"
  ),
  make_option(c("-d", "--denominator"),
    type = "character", default = NULL,
    help = "Denominator level for contrast factor",
    metavar = "character"
  ),
  make_option(c("-s", "--species"),
    type = "character", default = "homo-sapiens",
    help = "Species for annotation", metavar = "character"
  ),
  make_option(c("-o", "--output"),
    type = "character",
    default = "deseq2_results.csv",
    help = "Output CSV file for results", metavar = "character"
  ),
  make_option(c("-f", "--fc_threshold"),
    type = "double", default = 1,
    help = "Adjusted p-value threshold for significance"
  ),
  make_option(c("-p", "--p_threshold"),
    type = "double", default = 0.05,
    help = "Adjusted p-value threshold for significance"
  )
)

opt_parser <- OptionParser(option_list = option_list)
opt <- parse_args(opt_parser)

if (is.null(opt$count_matrix) || is.null(opt$metadata) || is.null(opt$contrast_factor) || is.null(opt$numerator) || is.null(opt$denominator)) {
  stop("Missing required arguments")
}

# Load count matrix and covariates metadata
count_long <- read.csv(opt$count_matrix, check.names = FALSE)
metadata <- read.table(opt$metadata,
  row.names = 1,
  sep = ",",
  header = TRUE,
  colClasses = "factor"
)

# Rename contrast factor removing weird characters
# This is done by default at the time of reading the metadata in the table
opt$contrast_factor <- make.names(opt$contrast_factor)

# Filter out samples for which we don't have metadata
count_long <- count_long[count_long[, "Sample"] %in% rownames(metadata), ]

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
  pivot_wider(names_from = Sample, values_from = `Raw gene expression`) %>%
  as.data.frame()

rownames(count_matrix) <- count_matrix$`Ensembl Id`
count_matrix <- count_matrix[, -1]

# Filter lowly expressed genes
filter_threshold <- 10
min_samples <- floor(ncol(count_matrix) / 2)

# Apply the filter
count_matrix <- count_matrix[rowSums(count_matrix >= filter_threshold) >= min_samples, ]

# Prepare DESeq2 dataset
dds <- DESeqDataSetFromMatrix(
  countData = count_matrix,
  colData = metadata,
  design = as.formula(paste("~", paste(colnames(metadata), collapse = " + ")))
)
dds <- DESeq(dds)


# Extract topTable
res <- results(dds, contrast = c(make.names(opt$contrast_factor), opt$numerator, opt$denominator))
res_df <- as.data.frame(res)

# Annotate genes
res_df <- annotate_results(res_df, opt$species)
res_df$EnsemblId <- rownames(res_df)
res_df$minlog10padj <- -log10(res_df$padj)
res_df$minlog10padj[is.na(res_df$minlog10padj)] <- NA

# Add regulation direction
res_df$Regulation <- ifelse(res_df$log2FoldChange >= opt$fc_threshold, "Up",
  ifelse(res_df$log2FoldChange <= -opt$fc_threshold,
    "Down", "NS"
  )
)

# Reorder columns
res_df <- res_df[, c(
  "EnsemblId", "SYMBOL", "Regulation",
  setdiff(colnames(res_df), c(
    "EnsemblId", "SYMBOL",
    "Regulation"
  ))
)]

# Add contrast column
contrast_label <- paste0(opt$numerator, " vs ", opt$denominator)
res_df$Contrast <- contrast_label

# Save topTable as csv
write.csv(res_df, opt$output, row.names = FALSE, na = "")
cat("Full results saved to", opt$output, "\n")

# Filter DEGs with adjusted p-value < 0.05 and absolute log2FoldChange > 0.6
deg_df <- res_df[
  res_df$padj <= opt$p_threshold & abs(res_df$log2FoldChange) >= opt$fc_threshold,
  c("EnsemblId", "Contrast", "SYMBOL", "log2FoldChange", "Regulation")
]
deg_df <- deg_df[!is.na(deg_df$EnsemblId), ]

# Save DEG as csv
# deg_output <- sub("\\.csv$", "_DEG.csv", opt$output)
write.csv(deg_df, "DEG.csv", row.names = FALSE, na = "")
cat("Filtered DEGs saved to", "DEG.csv", "\n")
