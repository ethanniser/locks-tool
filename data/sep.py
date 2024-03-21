import pandas as pd
import sys
import os

def convert_xlsx_to_csv(xlsx_file_path):
    # Load the Excel file
    xlsx = pd.ExcelFile(xlsx_file_path)

    # Iterate over all sheets in the Excel file
    for sheet_name in xlsx.sheet_names:
        # Read the current sheet
        df = pd.read_excel(xlsx, sheet_name)

        # Define the CSV file name
        csv_file_name = f"{sheet_name}.csv"

        # Save the DataFrame as a CSV file in the current working directory
        df.to_csv(csv_file_name, index=False)

        print(f"Saved sheet '{sheet_name}' to '{csv_file_name}'")

if __name__ == "__main__":
    # Check if the file path is provided as a command-line argument
    if len(sys.argv) != 2:
        print("Usage: python script.py <path_to_xlsx_file>")
        sys.exit(1)

    file_path = sys.argv[1]

    # Check if the file exists
    if not os.path.exists(file_path):
        print("Error: The specified file does not exist.")
        sys.exit(1)

    # Call the function to convert the Excel file to CSV files
    convert_xlsx_to_csv(file_path)
