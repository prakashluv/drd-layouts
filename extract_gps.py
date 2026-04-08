import pandas as pd
import requests
import re
import json
import os

file_path = r'C:\Users\praka\Downloads\Plots_Data.xlsx'
output_path = 'gps_results.json'

def get_coords(google_maps_link):
    if pd.isna(google_maps_link):
        return None
    try:
        r = requests.get(google_maps_link, allow_redirects=True, timeout=10)
        url = r.url
        # Try to find @lat,lng
        match = re.search(r'@([-0-9.]+),([-0-9.]+)', url)
        if not match:
            # Try q=lat,lng
            match = re.search(r'q=([-0-9.]+),([-0-9.]+)', url)
        
        if match:
            return [float(match.group(1)), float(match.group(2))]
    except Exception as e:
        print(f"Error for {google_maps_link}: {e}")
    return None

try:
    df = pd.read_excel(file_path)
    # Ensure Layout_Name and GPS Location columns exist
    if 'Layout_Name' in df.columns and 'GPS Location' in df.columns:
        links = df.groupby('Layout_Name')['GPS Location'].first().to_dict()
        
        results = {}
        for name, link in links.items():
            print(f"Processing {name}...")
            coords = get_coords(link)
            if coords:
                results[name] = coords
            else:
                results[name] = None
                
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"Saved results to {output_path}")
    else:
        print(f"Columns missing. Found: {df.columns.tolist()}")
except Exception as e:
    print(f"Main Error: {str(e)}")
