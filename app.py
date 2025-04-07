from flask import Flask, render_template, request, redirect, url_for, jsonify
import os
import pandas as pd
from werkzeug.utils import secure_filename
from flask import send_from_directory


app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'xlsx', 'xls'}
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'excelFile' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['excelFile']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        try:
            # Read Excel file and return basic info
            df = pd.read_excel(file_path)
            headers = df.columns.tolist()
            
            # Get a sample of the data for preview
            preview = df.head(5).to_dict('records')
            
            return jsonify({
                'success': True,
                'filename': filename,
                'headers': headers,
                'preview': preview,
                'rowCount': len(df)
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/process', methods=['POST'])
def process_data():
    data = request.get_json()
    
    if not data or 'filename' not in data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], data['filename'])
        df = pd.read_excel(file_path)
        
        # Get column and value fields
        column_fields = data.get('columnFields', [])
        value_fields = data.get('valueFields', [])
        
        if not column_fields or not value_fields:
            return jsonify({'error': 'Missing column or value fields'}), 400
        
        # Group by column fields and aggregate value fields
        grouped = df.groupby(column_fields)[value_fields].sum().reset_index()
        
        # Apply filters if any
        filters = data.get('filters', {})
        
        # Apply top N filter
        top_n = filters.get('topN')
        sort_order = filters.get('sortOrder', 'desc')
        
        if top_n and top_n != 'all':
            sort_by = value_fields[0] if value_fields else None
            if sort_by:
                ascending = sort_order == 'asc'
                grouped = grouped.sort_values(by=sort_by, ascending=ascending)
                grouped = grouped.head(int(top_n))
        
        # Convert to records for easy JSON serialization
        result = grouped.to_dict('records')
        
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/export', methods=['POST'])
def export_data():
    data = request.get_json()
    
    if not data or 'exportData' not in data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        export_data = data['exportData']
        filename = data.get('filename', 'export.xlsx')
        
        # Convert to DataFrame
        df = pd.DataFrame(export_data)
        
        # Save to Excel
        export_path = os.path.join(app.config['UPLOAD_FOLDER'], f"export_{filename}")
        df.to_excel(export_path, index=False)
        
        return jsonify({
            'success': True,
            'file_url': url_for('download_file', filename=f"export_{filename}")
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

import os

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))  # fallback to 5000 locally
    app.run(host='0.0.0.0', port=port, debug=True)
