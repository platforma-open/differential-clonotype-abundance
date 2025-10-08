import numpy as np
import pandas as pd
from patsy import dmatrix
import argparse
import os
import json

def is_full_rank(design_df, formula):
    """
    Checks if the model matrix from the design dataframe is full rank.
    
    Parameters:
    - design_df (pd.DataFrame): Experimental design table with categorical variables.
    - formula (str): Model formula using R-style syntax (e.g., "~condition + batch").
    
    Returns:
    - bool: True if full rank, False if rank-deficient.
    """
    try:
        # Generate the design matrix using Patsy
        model_matrix = np.asarray(dmatrix(formula, design_df, return_type="dataframe"))

        # Compute rank
        rank = np.linalg.matrix_rank(model_matrix)
        
        # Check if full rank
        return rank == model_matrix.shape[1]
    except Exception as e:
        print(f"Error in model matrix computation: {e}")
        return False
    
def export_result(content, output_dir, filename="continueOrNot.txt"):
    """ Export QC metrics to a CSV file """
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, filename)
    with open(output_path, "w") as f:
        f.write(content)

def main():
    parser = argparse.ArgumentParser(description='Previous data checks before starting differential analysis.')
    parser.add_argument('--metadata', type=str, required=True, help='Path to metadata CSV file')
    parser.add_argument('--output', type=str, required=True, help='Output directory')
    parser.add_argument('--contrast_factor', type=str, required=True, help='Contrast factor')
    parser.add_argument('--numerators', required=True, help='Numerators')
    parser.add_argument('--denominator', type=str, required=True, help='Denominator')
    parser.add_argument('--error_output', type=str, required=True, help='Error output directory')
    args = parser.parse_args()

    # Convert numerators json to list
    numerators = json.loads(args.numerators)

    # Load metadata
    metadata = pd.read_csv(args.metadata, dtype=str)
    # Set sample as index
    metadata.set_index(keys="Sample", inplace=True)
    # Create error logs table
    df_error = pd.DataFrame(columns=["Error", "value"])
    errorLogs = []
    # Make sure we have enough replicates for all the comparisons that are going be done
    for numerator in numerators:
        # Make sure at least we have a sample with enough replicates
        if int(metadata[args.contrast_factor].value_counts()[[str(numerator), str(args.denominator)]].max()) == 1:
            errorLogs.append(f"Warning: This block requires replicates to perform the analysis. It is not feasible to compare {numerator} vs {args.denominator} because there is only one sample for each condition.")
            
    if len(errorLogs) > 0:
        export_result("stop", args.output)
    else:
         # Rename columns to numbers toa void issues related to weird characters
        metadata.columns = [f"c{i}" for i in range(len(metadata.columns))]
        # Get formula
        formula = "~" + " + ".join(metadata.columns)
        # Check if the design matrix is full rank
        rankResult = is_full_rank(metadata, formula)

        # Write result to file
        if rankResult:
            export_result("continue", args.output)
        else:
            errorLogs.append("Warning: The model matrix is not full rank, so the model cannot be fit as specified. \
              One or more variables or interaction terms in the design formula are linear\
              combinations of the others and must be removed. Please, check the metadata \
              columns included in the Design section.")
            export_result("stop", args.output)

    # output error logs table
    df_error['Error'] = range(len(errorLogs))
    df_error['value'] = errorLogs
    df_error.to_csv(args.error_output, index=False)

if __name__ == "__main__":
    main()
