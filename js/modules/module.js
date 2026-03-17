import * as monaco from 'monaco-editor';

self.MonacoEnvironment = {
	getWorkerUrl: function (moduleId, label) {
		if (label === 'json') {
			return './json.worker.js';
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
		},
		name: {
			title: 'Name',
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

const model = monaco.editor.createModel('{\n  "file": ""\n}\n', 'json', modelUri);

const editor = monaco.editor.create(document.getElementById('container'), {
	model
});

const messageDisplay = document.getElementById('message');
const fileValueDecorations = editor.createDecorationsCollection();

const styles = document.createElement('style');
styles.textContent = `
	.monaco-editor .file-value-hidden {
		opacity: 0;
	}

	.monaco-editor .inline-file-input {
		box-sizing: border-box;
		width: 240px;
		max-width: 240px;
	}
`;
document.head.appendChild(styles);

let fileValueRange = null;
let uploadedFileContent = '';
let uploadedFileName = '';

function setMessage(message, type = '') {
	messageDisplay.textContent = message;
	messageDisplay.style.color = type === 'error' ? 'red' : type === 'success' ? 'green' : '';
};

function parseModelJson(source) {
	if (typeof source === 'undefined') {
		source = model.getValue();
	}

	return JSON.parse(source);
}

const hasFileProperty = (json) =>
	Object.prototype.hasOwnProperty.call(json, 'file');

const getUploadedPlaceholder = (filename) => `[uploaded: ${filename}]`;

function resetUploadedFileState() {
	uploadedFileContent = '';
	uploadedFileName = '';
	fileInput.value = '';
};

function getFileValueRange(source) {
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

function updateFileField(nextValue) {
	const json = parseModelJson();
	json.file = nextValue;
	model.setValue(`${JSON.stringify(json, null, 2)}\n`);
};

function readTextFile(file) {
	return new Promise(function (resolve, reject) {
		const reader = new FileReader();

		reader.onload = function () {
			resolve(typeof reader.result === 'string' ? reader.result : '');
		};

		reader.onerror = function () {
			reject(reader.error || new Error('Unable to read the selected file.'));
		};

		reader.readAsText(file);
	});
}

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'text/*';
fileInput.className = 'inline-file-input';

const fileInputWidget = {
	getId() {
		return 'file-input-widget';
	},
	getDomNode() {
		return fileInput;
	},
	getPosition() {
		if (!fileValueRange || uploadedFileName) {
			return null;
		}

		return {
			position: {
				lineNumber: fileValueRange.startLineNumber,
				column: fileValueRange.startColumn
			},
			preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
		};
	}
};

editor.addContentWidget(fileInputWidget);

function syncInlineFileInput() {
	try {
		const source = model.getValue();
		const json = parseModelJson(source);

		if (!hasFileProperty(json)) {
			fileValueRange = null;
			resetUploadedFileState();
			fileValueDecorations.clear();
			editor.layoutContentWidget(fileInputWidget);
			return;
		}

		const expectedPlaceholder = uploadedFileName
			? getUploadedPlaceholder(uploadedFileName)
			: null;

		if (expectedPlaceholder && json.file !== expectedPlaceholder) {
			resetUploadedFileState();
		}

		fileValueRange = getFileValueRange(source);

		if (!fileValueRange) {
			fileValueDecorations.clear();
			editor.layoutContentWidget(fileInputWidget);
			return;
		}

		if (uploadedFileName) {
			fileValueDecorations.clear();
		} else {
			fileValueDecorations.set([
				{
					range: fileValueRange,
					options: {
						inlineClassName: 'file-value-hidden',
						inlineClassNameAffectsLetterSpacing: true
					}
				}
			]);
		}

		editor.layoutContentWidget(fileInputWidget);
	} catch {
		fileValueRange = null;
		fileValueDecorations.clear();
		editor.layoutContentWidget(fileInputWidget);
	}
};

async function handleFileSelection(event) {
	const file = event.target.files && event.target.files[0];

	console.log("test");

	setMessage('');

	if (!file) {
		setMessage('No file selected. Please choose a file.', 'error');
		return;
	}

	const looksLikeText =
		!file.type ||
		file.type.startsWith('text/') ||
		file.type === 'application/json';

	if (!looksLikeText) {
		setMessage('Unsupported file type. Please select a text file.', 'error');
		fileInput.value = '';
		return;
	}

	try {
		const content = await readTextFile(file);

		uploadedFileContent = content;
		uploadedFileName = file.name;

		updateFileField(getUploadedPlaceholder(file.name));
		
		setMessage(`Uploaded ${content}.`, 'success');
		
		console.log('Visible editor value:', editor.getValue());
		console.log('Submisson value:', getSubmissionString());

		fileInput.value = '';
	} catch {
		setMessage('Error reading the file. Please try again.', 'error');
		fileInput.value = '';
	}
};

fileInput.addEventListener('change', handleFileSelection);
model.onDidChangeContent(syncInlineFileInput);
editor.onDidLayoutChange(() => editor.layoutContentWidget(fileInputWidget));

syncInlineFileInput();

/**
 * Use this when you need the real JSON payload.
 * The Monaco editor keeps the short placeholder.
 * Submission swaps that placeholder back to the real uploaded content.
 */
function getSubmissionJson() {
	const json = parseModelJson();

	if (uploadedFileName) {
		json.file = uploadedFileContent;
	}

	return json;
};

const getSubmissionString = () =>
	`${JSON.stringify(getSubmissionJson(), null, 2)}\n`;

// Optional: expose helpers for debugging/demo
window.getSubmissionJson = getSubmissionJson;
window.getSubmissionString = getSubmissionString;