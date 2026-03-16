import * as monaco from 'monaco-editor';

self.MonacoEnvironment = {
	getWorkerUrl: function (moduleId, label) {
		if (label === 'json') {
			return './json.worker.js';
		}
		if (label === 'css' || label === 'scss' || label === 'less') {
			return './css.worker.js';
		}
		if (label === 'html' || label === 'handlebars' || label === 'razor') {
			return './html.worker.js';
		}
		if (label === 'typescript' || label === 'javascript') {
			return './ts.worker.js';
		}
		return './editor.worker.js';
	}
};

const schema = {
	type: 'object',
	properties: {
		file: {
			pattern: '([A-Za-z0-9+/3]*([A-Za-z0-9+/]{3}=/[A-Za-z0-9+/]{2}==)?$)',
			file: true,
			title: 'File',
			type: 'string'
		}
	},
	required: ['file']
};

const modelUri = monaco.Uri.parse('inmemory://model/foo.json');

monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
	validate: true,
	schemas: [
		{
			uri: 'https://myserver/foo-schema.json',
			fileMatch: [modelUri.toString()],
			schema
		}
	]
});

const model = monaco.editor.createModel('{\n  "file": ""\n}', 'json', modelUri);
const editor = monaco.editor.create(document.getElementById('container'), { model });

const fileInputStyles = document.createElement('style');
fileInputStyles.textContent = `
	.monaco-editor .file-value-hidden {
		opacity: 0;
	}
`;
document.head.appendChild(fileInputStyles);

const fileInput = document.getElementById('file-input');
const messageDisplay = document.getElementById('message');
const fileValueDecorations = editor.createDecorationsCollection();

let fileValueRange = null;

fileInput.hidden = false;
fileInput.style.position = 'absolute';
fileInput.style.display = 'none';
fileInput.style.zIndex = '20';
editor.getDomNode().appendChild(fileInput);

const setMessage = (message, type = '') => {
	messageDisplay.textContent = message;
	messageDisplay.style.color = type === 'error' ? 'red' : type === 'success' ? 'green' : '';
};

const parseModelJson = (source) => JSON.parse(source);

const getFileValueRange = (source) => {
	const fileEntryMatch = /"file"\s*:\s*("([^"\\]|\\.)*")/.exec(source);

	if (!fileEntryMatch) {
		return null;
	}

	const valueText = fileEntryMatch[1];
	const valueOffset = fileEntryMatch.index + fileEntryMatch[0].lastIndexOf(valueText);
	const valueStart = model.getPositionAt(valueOffset);
	const valueEnd = model.getPositionAt(valueOffset + valueText.length);

	return new monaco.Range(
		valueStart.lineNumber,
		valueStart.column,
		valueEnd.lineNumber,
		valueEnd.column
	);
};

const hideInlineFileInput = () => {
	fileValueRange = null;
	fileInput.style.display = 'none';
	fileValueDecorations.clear();
};

const positionInlineFileInput = () => {
	if (!fileValueRange) {
		fileInput.style.display = 'none';
		return;
	}

	const visiblePosition = editor.getScrolledVisiblePosition({
		lineNumber: fileValueRange.startLineNumber,
		column: fileValueRange.startColumn
	});

	if (!visiblePosition) {
		fileInput.style.display = 'none';
		return;
	}

	fileInput.style.display = 'block';
	fileInput.style.left = `${visiblePosition.left}px`;
	fileInput.style.top = `${visiblePosition.top}px`;
};

const updateFileField = (nextValue) => {
	const json = parseModelJson(model.getValue());
	json.file = nextValue;
	model.setValue(`${JSON.stringify(json, null, 2)}\n`);
};

const syncInlineFileInput = () => {
	try {
		const source = model.getValue();
		const json = parseModelJson(source);

		if (!Object.prototype.hasOwnProperty.call(json, 'file')) {
			hideInlineFileInput();
			return;
		}

		fileValueRange = getFileValueRange(source);

		if (!fileValueRange) {
			hideInlineFileInput();
			return;
		}

		fileValueDecorations.set([
			{
				range: fileValueRange,
				options: {
					inlineClassName: 'file-value-hidden',
					inlineClassNameAffectsLetterSpacing: true
				}
			}
		]);

		positionInlineFileInput();
	} catch {
		hideInlineFileInput();
	}
};

const readTextFile = (file) =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => {
			resolve(typeof reader.result === 'string' ? reader.result : '');
		};

		reader.onerror = () => {
			reject(reader.error || new Error('Unable to read the selected file.'));
		};

		reader.readAsText(file);
	});

const handleFileSelection = async (event) => {
	const file = event.target.files && event.target.files[0];

	setMessage('');

	if (!file) {
		setMessage('No file selected. Please choose a file.', 'error');
		return;
	}

	if (!file.type.startsWith('text')) {
		setMessage('Unsupported file type. Please select a text file.', 'error');
		fileInput.value = '';
		return;
	}

	try {
		const content = await readTextFile(file);
		updateFileField(content);
	} catch {
		setMessage('Error reading the file. Please try again.', 'error');
		fileInput.value = '';
	}
};

fileInput.addEventListener('change', handleFileSelection);
editor.onDidScrollChange(positionInlineFileInput);
editor.onDidLayoutChange(positionInlineFileInput);
model.onDidChangeContent(syncInlineFileInput);
syncInlineFileInput();
