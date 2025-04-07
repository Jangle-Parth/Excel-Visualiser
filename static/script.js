document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let excelData = null;
    let workbook = null;
    let currentSheet = null;
    let headers = [];
    let dataTypes = {};
    let currentChart = null;
    let savedReports = JSON.parse(localStorage.getItem('savedReports') || '[]');
    
    // DOM elements
    const uploadForm = document.getElementById('uploadForm');
    const excelFileInput = document.getElementById('excelFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const uploadSection = document.getElementById('uploadSection');
    const mainInterface = document.getElementById('mainInterface');
    const availableFields = document.getElementById('availableFields');
    const columnDropzone = document.getElementById('columnDropzone');
    const valueDropzone = document.getElementById('valueDropzone');
    const columnDropzoneContent = document.getElementById('columnDropzoneContent');
    const valueDropzoneContent = document.getElementById('valueDropzoneContent');
    const chartTypeSelect = document.getElementById('chartType');
    const generateVisualizationBtn = document.getElementById('generateVisualization');
    const saveReportBtn = document.getElementById('saveReport');
    const exportExcelBtn = document.getElementById('exportExcel');
    const chartContainer = document.getElementById('chartContainer');
    const dataTable = document.getElementById('dataTable');
    const topNFilter = document.getElementById('topNFilter');
    const sortOrder = document.getElementById('sortOrder');
    const customFilters = document.getElementById('customFilters');
    const addFilterBtn = document.getElementById('addFilterBtn');
    const savedReportsList = document.getElementById('savedReportsList');
    
    // Modal elements
    const saveReportModal = document.getElementById('saveReportModal');
    const saveReportForm = document.getElementById('saveReportForm');
    const customFilterModal = document.getElementById('customFilterModal');
    const customFilterForm = document.getElementById('customFilterForm');
    const filterField = document.getElementById('filterField');
    const closeButtons = document.querySelectorAll('.close');
    
    // Event listeners - File handling
    excelFileInput.addEventListener('change', function(e) {
        if (this.files[0]) {
            fileNameDisplay.textContent = this.files[0].name;
        } else {
            fileNameDisplay.textContent = 'No file chosen';
        }
    });
    
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const file = excelFileInput.files[0];
        if (!file) {
            alert('Please select an Excel file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                workbook = XLSX.read(data, { type: 'array' });
                
                // Get the first sheet
                const firstSheetName = workbook.SheetNames[0];
                currentSheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON
                excelData = XLSX.utils.sheet_to_json(currentSheet, { header: 1 });
                
                if (excelData.length < 2) {
                    alert('The Excel file does not contain enough data');
                    return;
                }
                
                // Show the main interface
                uploadSection.classList.add('hidden');
                mainInterface.classList.remove('hidden');
                
                // Process data and initialize interface
                initializeInterface();
            } catch (error) {
                console.error('Error processing Excel file:', error);
                alert('Error processing Excel file. Please ensure it is a valid Excel file.');
            }
        };
        
        reader.onerror = function() {
            alert('Error reading the file');
        };
        
        reader.readAsArrayBuffer(file);
    });
    
    // Initialize interface with data from Excel
    function initializeInterface() {
        // Extract headers from the first row
        headers = excelData[0];
        
        // Determine data types for each column
        determineDataTypes();
        
        // Populate available fields
        populateAvailableFields();
        
        // Set up drag and drop
        setupDragAndDrop();
        
        // Update filter field dropdown
        updateFilterFieldDropdown();
        
        // Check if there's a pending report to load
        const pendingReportId = localStorage.getItem('pendingReportId');
        if (pendingReportId) {
            loadSavedReport(pendingReportId);
            localStorage.removeItem('pendingReportId');
        }
    }
    
    // Determine data types for each column
    function determineDataTypes() {
        dataTypes = {};
        
        // Check a sample of data rows to determine type
        const sampleSize = Math.min(20, excelData.length - 1);
        
        headers.forEach((header, index) => {
            let isNumber = true;
            let isDate = true;
            
            for (let i = 1; i <= sampleSize; i++) {
                const value = excelData[i][index];
                
                if (value === undefined || value === null || value === '') continue;
                
                // Check if it's a number
                if (isNumber && isNaN(Number(value))) {
                    isNumber = false;
                }
                
                // Check if it's a date
                if (isDate) {
                    const dateObj = new Date(value);
                    if (isNaN(dateObj.getTime()) || typeof value === 'number') {
                        isDate = false;
                    }
                }
                
                if (!isNumber && !isDate) break;
            }
            
            if (isNumber) {
                dataTypes[header] = 'number';
            } else if (isDate) {
                dataTypes[header] = 'date';
            } else {
                dataTypes[header] = 'text';
            }
        });
    }
    
    // Populate available fields
    function populateAvailableFields() {
        availableFields.innerHTML = '';
        
        headers.forEach(header => {
            const fieldItem = document.createElement('div');
            fieldItem.className = 'field-item';
            fieldItem.setAttribute('draggable', 'true');
            fieldItem.setAttribute('data-field', header);
            fieldItem.setAttribute('data-type', dataTypes[header]);
            
            let icon;
            switch (dataTypes[header]) {
                case 'number':
                    icon = 'fa-hashtag';
                    break;
                case 'date':
                    icon = 'fa-calendar';
                    break;
                default:
                    icon = 'fa-font';
            }
            
            fieldItem.innerHTML = `
                <i class="fas ${icon}"></i>
                <span>${header}</span>
            `;
            
            // Add drag events
            fieldItem.addEventListener('dragstart', handleDragStart);
            
            availableFields.appendChild(fieldItem);
        });
    }
    
    // Set up drag and drop functionality
    function setupDragAndDrop() {
        // Add dropzone events
        [columnDropzone, valueDropzone].forEach(dropzone => {
            dropzone.addEventListener('dragover', handleDragOver);
            dropzone.addEventListener('dragleave', handleDragLeave);
            dropzone.addEventListener('drop', handleDrop);
        });
    }
    
    // Drag events
    function handleDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.getAttribute('data-field'));
        e.dataTransfer.effectAllowed = 'copy';
    }
    
    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        this.classList.add('drag-over');
    }
    
    function handleDragLeave(e) {
        this.classList.remove('drag-over');
    }
    
    function handleDrop(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        const fieldName = e.dataTransfer.getData('text/plain');
        const dropzoneId = this.id;
        const fieldType = getDataType(fieldName);
        
        // Add the field to the appropriate dropzone
        addFieldToDropzone(fieldName, dropzoneId, fieldType);
    }
    
    function getDataType(fieldName) {
        return dataTypes[fieldName] || 'text';
    }
    
    function addFieldToDropzone(fieldName, dropzoneId, fieldType) {
        const dropzoneContent = document.getElementById(`${dropzoneId}Content`);
        
        // Check if field already exists in this dropzone
        const existingFields = dropzoneContent.querySelectorAll('.dropped-field');
        for (let field of existingFields) {
            if (field.getAttribute('data-field') === fieldName) {
                return; // Field already exists
            }
        }
        
        let icon;
        switch (fieldType) {
            case 'number':
                icon = 'fa-hashtag';
                break;
            case 'date':
                icon = 'fa-calendar';
                break;
            default:
                icon = 'fa-font';
        }
        
        const droppedField = document.createElement('div');
        droppedField.className = 'dropped-field';
        droppedField.setAttribute('data-field', fieldName);
        droppedField.innerHTML = `
            <div class="field-name">
                <i class="fas ${icon}"></i>
                <span>${fieldName}</span>
            </div>
            <button type="button" class="remove-field">×</button>
        `;
        
        // Add event listener to remove button
        droppedField.querySelector('.remove-field').addEventListener('click', function() {
            dropzoneContent.removeChild(droppedField);
        });
        
        dropzoneContent.appendChild(droppedField);
    }
    
    // Generate visualization based on selected fields
    generateVisualizationBtn.addEventListener('click', function() {
        const columnFields = Array.from(columnDropzoneContent.querySelectorAll('.dropped-field'))
            .map(field => field.getAttribute('data-field'));
            
        const valueFields = Array.from(valueDropzoneContent.querySelectorAll('.dropped-field'))
            .map(field => field.getAttribute('data-field'));
            
        if (columnFields.length === 0 || valueFields.length === 0) {
            alert('Please drag at least one field to both Column and Value dropzones');
            return;
        }
        
        // Process data for visualization
        const processedData = processDataForVisualization(columnFields, valueFields);
        
        // Generate the visualization
        createVisualization(processedData, columnFields, valueFields);
    });
    
    // Process data for visualization
    function processDataForVisualization(columnFields, valueFields) {
        // Skip header row and get data rows
        const dataRows = excelData.slice(1);
        
    // Get indexes of selected fields
    const columnIndexes = columnFields.map(field => headers.indexOf(field));
    const valueIndexes = valueFields.map(field => headers.indexOf(field));
    
    // Group data by column fields
    const groupedData = {};
    
    dataRows.forEach(row => {
        // Create a composite key for multiple column fields
        const groupKey = columnIndexes.map(index => row[index]).join('___');
        
        if (!groupedData[groupKey]) {
            // Initialize with column values and empty aggregates for values
            groupedData[groupKey] = {
                columns: columnIndexes.map(index => row[index]),
                values: valueIndexes.map(() => [])
            };
        }
        
        // Add values to their respective arrays
        valueIndexes.forEach((valueIndex, i) => {
            const value = row[valueIndex];
            if (value !== undefined && value !== null && value !== '') {
                // Convert to number if possible
                const numValue = Number(value);
                groupedData[groupKey].values[i].push(isNaN(numValue) ? 0 : numValue);
            }
        });
    });
    
    // Aggregate values (sum by default)
    const aggregatedData = Object.values(groupedData).map(item => {
        return {
            columns: item.columns,
            values: item.values.map(valueArray => 
                valueArray.reduce((sum, val) => sum + val, 0)
            )
        };
    });
    
    // Apply filters
    let filteredData = applyFilters(aggregatedData);
    
    return filteredData;    
    }

// Apply all filters to the data
function applyFilters(data) {
    let filteredData = [...data];
    
    // Apply custom filters
    const customFilterElements = document.querySelectorAll('.custom-filter');
    customFilterElements.forEach(filterEl => {
        const field = filterEl.getAttribute('data-field');
        const operator = filterEl.getAttribute('data-operator');
        const filterValue = filterEl.getAttribute('data-value');
        
        const fieldIndex = headers.indexOf(field);
        
        if (fieldIndex !== -1) {
            const isColumnField = Array.from(columnDropzoneContent.querySelectorAll('.dropped-field'))
                .some(f => f.getAttribute('data-field') === field);
            
            const isValueField = Array.from(valueDropzoneContent.querySelectorAll('.dropped-field'))
                .some(f => f.getAttribute('data-field') === field);
            
            filteredData = filteredData.filter(item => {
                if (isColumnField) {
                    const columnIndex = Array.from(columnDropzoneContent.querySelectorAll('.dropped-field'))
                        .map(f => f.getAttribute('data-field'))
                        .indexOf(field);
                    
                    if (columnIndex !== -1) {
                        const value = item.columns[columnIndex];
                        return applyFilterOperator(value, operator, filterValue);
                    }
                }
                
                if (isValueField) {
                    const valueIndex = Array.from(valueDropzoneContent.querySelectorAll('.dropped-field'))
                        .map(f => f.getAttribute('data-field'))
                        .indexOf(field);
                    
                    if (valueIndex !== -1) {
                        const value = item.values[valueIndex];
                        return applyFilterOperator(value, operator, filterValue);
                    }
                }
                
                return true;
            });
        }
    });
    
    // Apply Top N filter
    const topN = topNFilter.value;
    const sortDir = sortOrder.value;
    
    if (topN !== 'all') {
        // Sort by the first value field
        filteredData.sort((a, b) => {
            const valueA = a.values[0] || 0;
            const valueB = b.values[0] || 0;
            return sortDir === 'desc' ? valueB - valueA : valueA - valueB;
        });
        
        // Take only top N
        filteredData = filteredData.slice(0, parseInt(topN));
    } else {
        // Just sort the data
        filteredData.sort((a, b) => {
            const valueA = a.values[0] || 0;
            const valueB = b.values[0] || 0;
            return sortDir === 'desc' ? valueB - valueA : valueA - valueB;
        });
    }
    
    return filteredData;
}

// Helper function to apply filter operators
function applyFilterOperator(value, operator, filterValue) {
    // Convert to same type for comparison
    const isNumber = !isNaN(Number(value)) && !isNaN(Number(filterValue));
    
    let actualValue = value;
    let actualFilterValue = filterValue;
    
    if (isNumber) {
        actualValue = Number(value);
        actualFilterValue = Number(filterValue);
    } else {
        actualValue = String(value).toLowerCase();
        actualFilterValue = String(filterValue).toLowerCase();
    }
    
    switch (operator) {
        case 'equals':
            return actualValue === actualFilterValue;
        case 'notEquals':
            return actualValue !== actualFilterValue;
        case 'contains':
            return String(actualValue).includes(String(actualFilterValue));
        case 'greaterThan':
            return actualValue > actualFilterValue;
        case 'lessThan':
            return actualValue < actualFilterValue;
        default:
            return true;
    }
}

// Create visualization based on processed data
function createVisualization(data, columnFields, valueFields) {
    const chartType = chartTypeSelect.value;
    
    // Clear previous chart if exists
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
    
    // Clear chart container and data table
    chartContainer.innerHTML = '';
    dataTable.innerHTML = '';
    
    // Show appropriate visualization container
    if (chartType === 'table') {
        chartContainer.classList.add('hidden');
        dataTable.classList.remove('hidden');
        createDataTable(data, columnFields, valueFields);
    } else {
        chartContainer.classList.remove('hidden');
        dataTable.classList.add('hidden');
        createChart(data, columnFields, valueFields, chartType);
    }
}

// Create chart visualization
function createChart(data, columnFields, valueFields, chartType) {
    // Prepare chart data
    const labels = data.map(item => 
        item.columns.length > 1 
            ? item.columns.join(' - ') 
            : item.columns[0]
    );
    
    const datasets = valueFields.map((field, index) => {
        return {
            label: field,
            data: data.map(item => item.values[index] || 0),
            backgroundColor: getColor(index, valueFields.length),
            borderColor: getColor(index, valueFields.length),
            borderWidth: 1
        };
    });
    
    // Create canvas for chart
    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);
    
    // Create chart
    const ctx = canvas.getContext('2d');
    currentChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Create data table visualization
function createDataTable(data, columnFields, valueFields) {
    // Create table element
    const table = document.createElement('table');
    
    // Create header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Add column field headers
    columnFields.forEach(field => {
        const th = document.createElement('th');
        th.textContent = field;
        headerRow.appendChild(th);
    });
    
    // Add value field headers
    valueFields.forEach(field => {
        const th = document.createElement('th');
        th.textContent = field;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    // Add data rows
    data.forEach(item => {
        const row = document.createElement('tr');
        
        // Add column values
        item.columns.forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            row.appendChild(td);
        });
        
        // Add data values
        item.values.forEach(value => {
            const td = document.createElement('td');
            td.textContent = formatNumber(value);
            row.appendChild(td);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    dataTable.appendChild(table);
}

// Format number for display
function formatNumber(value) {
    if (typeof value !== 'number') return value;
    
    // Format with thousand separators and 2 decimal places if needed
    return value % 1 === 0 
        ? value.toLocaleString()
        : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Get color for chart series
function getColor(index, total) {
    const colors = [
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)',
        'rgba(199, 199, 199, 0.8)',
        'rgba(83, 102, 255, 0.8)',
        'rgba(40, 159, 64, 0.8)',
        'rgba(210, 199, 199, 0.8)'
    ];
    
    return colors[index % colors.length];
}

// Update filter field dropdown
function updateFilterFieldDropdown() {
    filterField.innerHTML = '';
    
    headers.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        filterField.appendChild(option);
    });
}

// Save Report functionality
saveReportBtn.addEventListener('click', function() {
    saveReportModal.classList.remove('hidden');
});

saveReportForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const reportName = document.getElementById('reportName').value.trim();
    const reportDescription = document.getElementById('reportDescription').value.trim();
    
    if (!reportName) {
        alert('Please enter a report name');
        return;
    }
    
    // Get current configuration
    const configuration = {
        id: Date.now().toString(),
        name: reportName,
        description: reportDescription,
        timestamp: new Date().toISOString(),
        columnFields: Array.from(columnDropzoneContent.querySelectorAll('.dropped-field'))
            .map(field => field.getAttribute('data-field')),
        valueFields: Array.from(valueDropzoneContent.querySelectorAll('.dropped-field'))
            .map(field => field.getAttribute('data-field')),
        chartType: chartTypeSelect.value,
        filters: {
            topN: topNFilter.value,
            sortOrder: sortOrder.value,
            customFilters: Array.from(customFilters.querySelectorAll('.custom-filter'))
                .map(filter => ({
                    field: filter.getAttribute('data-field'),
                    operator: filter.getAttribute('data-operator'),
                    value: filter.getAttribute('data-value')
                }))
        }
    };
    
    // Add to saved reports
    savedReports.push(configuration);
    
    // Save to localStorage
    localStorage.setItem('savedReports', JSON.stringify(savedReports));
    
    // Update the saved reports list
    updateSavedReportsList();
    
    // Close modal
    saveReportModal.classList.add('hidden');
    
    // Reset form
    saveReportForm.reset();
    
    alert('Report template saved successfully!');
});

// Export to Excel functionality
exportExcelBtn.addEventListener('click', function() {
    const columnFields = Array.from(columnDropzoneContent.querySelectorAll('.dropped-field'))
        .map(field => field.getAttribute('data-field'));
        
    const valueFields = Array.from(valueDropzoneContent.querySelectorAll('.dropped-field'))
        .map(field => field.getAttribute('data-field'));
        
    if (columnFields.length === 0 || valueFields.length === 0) {
        alert('Please generate a visualization first');
        return;
    }
    
    // Process data for export
    const processedData = processDataForVisualization(columnFields, valueFields);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create headers row
    const headers = [...columnFields, ...valueFields];
    
    // Create data rows
    const rows = processedData.map(item => {
        return [
            ...item.columns,
            ...item.values
        ];
    });
    
    // Combine headers and rows
    const exportData = [headers, ...rows];
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Visualization');
    
    // Export workbook
    XLSX.writeFile(wb, 'visualization_export.xlsx');
});

// Add custom filter functionality
addFilterBtn.addEventListener('click', function() {
    customFilterModal.classList.remove('hidden');
});

customFilterForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const field = filterField.value;
    const operator = document.getElementById('filterOperator').value;
    const filterValue = document.getElementById('filterValue').value;
    
    if (!field || !filterValue) {
        alert('Please fill in all filter fields');
        return;
    }
    
    // Create filter element
    const filterEl = document.createElement('div');
    filterEl.className = 'custom-filter';
    filterEl.setAttribute('data-field', field);
    filterEl.setAttribute('data-operator', operator);
    filterEl.setAttribute('data-value', filterValue);
    
    // Create operator text
    let operatorText;
    switch (operator) {
        case 'equals': operatorText = '='; break;
        case 'notEquals': operatorText = '≠'; break;
        case 'contains': operatorText = 'contains'; break;
        case 'greaterThan': operatorText = '>'; break;
        case 'lessThan': operatorText = '<'; break;
        default: operatorText = operator;
    }
    
    filterEl.innerHTML = `
        <div class="filter-text">${field} ${operatorText} ${filterValue}</div>
        <button type="button" class="remove-filter">×</button>
    `;
    
    // Add remove event listener
    filterEl.querySelector('.remove-filter').addEventListener('click', function() {
        customFilters.removeChild(filterEl);
    });
    
    customFilters.appendChild(filterEl);
    
    // Close modal and reset form
    customFilterModal.classList.add('hidden');
    customFilterForm.reset();
});

// Close modal buttons
closeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        modal.classList.add('hidden');
    });
});

// Update saved reports list
function updateSavedReportsList() {
    savedReportsList.innerHTML = '';
    
    if (savedReports.length === 0) {
        savedReportsList.innerHTML = '<p>No saved reports yet</p>';
        return;
    }
    
    savedReports.forEach(report => {
        const reportItem = document.createElement('div');
        reportItem.className = 'saved-report-item';
        reportItem.innerHTML = `
            <div class="report-info">
                <h4>${report.name}</h4>
                <p>${report.description || 'No description'}</p>
                <small>Created: ${new Date(report.timestamp).toLocaleDateString()}</small>
            </div>
            <div class="report-actions">
                <button type="button" class="load-report" data-id="${report.id}">Load</button>
                <button type="button" class="delete-report" data-id="${report.id}">Delete</button>
            </div>
        `;
        
        // Add event listeners
        reportItem.querySelector('.load-report').addEventListener('click', function() {
            const reportId = this.getAttribute('data-id');
            localStorage.setItem('pendingReportId', reportId);
            
            // If we're already in the main interface, load the report directly
            if (!mainInterface.classList.contains('hidden')) {
                loadSavedReport(reportId);
                localStorage.removeItem('pendingReportId');
            } else {
                // Otherwise wait for a file to be uploaded
                alert('Please upload an Excel file to load this report');
            }
        });
        
        reportItem.querySelector('.delete-report').addEventListener('click', function() {
            const reportId = this.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this report template?')) {
                savedReports = savedReports.filter(r => r.id !== reportId);
                localStorage.setItem('savedReports', JSON.stringify(savedReports));
                updateSavedReportsList();
            }
        });
        
        savedReportsList.appendChild(reportItem);
    });
}

// Load a saved report
function loadSavedReport(reportId) {
    const report = savedReports.find(r => r.id === reportId);
    
    if (!report) {
        alert('Report not found');
        return;
    }
    
    // Clear existing fields
    columnDropzoneContent.innerHTML = '';
    valueDropzoneContent.innerHTML = '';
    customFilters.innerHTML = '';
    
    // Set chart type
    chartTypeSelect.value = report.chartType;
    
    // Set filters
    topNFilter.value = report.filters.topN;
    sortOrder.value = report.filters.sortOrder;
    
    // Add column fields
    report.columnFields.forEach(field => {
        addFieldToDropzone(field, 'columnDropzone', getDataType(field));
    });
    
    // Add value fields
    report.valueFields.forEach(field => {
        addFieldToDropzone(field, 'valueDropzone', getDataType(field));
    });
    
    // Add custom filters
    report.filters.customFilters.forEach(filter => {
        const filterEl = document.createElement('div');
        filterEl.className = 'custom-filter';
        filterEl.setAttribute('data-field', filter.field);
        filterEl.setAttribute('data-operator', filter.operator);
        filterEl.setAttribute('data-value', filter.value);
        
        let operatorText;
        switch (filter.operator) {
            case 'equals': operatorText = '='; break;
            case 'notEquals': operatorText = '≠'; break;
            case 'contains': operatorText = 'contains'; break;
            case 'greaterThan': operatorText = '>'; break;
            case 'lessThan': operatorText = '<'; break;
            default: operatorText = filter.operator;
        }
        
        filterEl.innerHTML = `
            <div class="filter-text">${filter.field} ${operatorText} ${filter.value}</div>
            <button type="button" class="remove-filter">×</button>
        `;
        
        filterEl.querySelector('.remove-filter').addEventListener('click', function() {
            customFilters.removeChild(filterEl);
        });
        
        customFilters.appendChild(filterEl);
    });
    
    // Auto-generate visualization
    generateVisualizationBtn.click();
}

// Initialize saved reports list
updateSavedReportsList();
});