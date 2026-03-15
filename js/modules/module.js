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
}

const modelUri = monaco.Uri.parse('inmemory://model/foo.json');

monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
	validate: true,
	schemas: [{
		uri: 'https://myserver/foo-schema.json',
		fileMatch: [modelUri.toString()],
		schema
	}]
});

const model = monaco.editor.createModel(
	'{\n  "file": ""\n}',
	'json',
	modelUri
);

const editor = monaco.editor.create(document.getElementById('container'), {
	model
});

const fileWidgetStyles = document.createElement('style');
fileWidgetStyles.textContent = `
	.monaco-editor .file-value-hidden {
		opacity: 0;
	}
`;
document.head.appendChild(fileWidgetStyles);

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.hidden = true;
document.body.appendChild(fileInput);

let fileValueDecorationIds = [];
let currentFileFieldState = null;

const fileButton = document.createElement('button');
fileButton.type = 'button';
fileButton.textContent = 'Choose file';
fileButton.style.position = 'absolute';
fileButton.style.display = 'none';
fileButton.style.zIndex = '20';
fileButton.style.cursor = 'pointer';
fileButton.style.minWidth = '125px';
fileButton.style.padding = '0 10px';
fileButton.style.border = '1px solid #0f172a';
fileButton.style.borderRadius = '6px';
fileButton.style.background = '#ffffff';
fileButton.style.color = '#0f172a';
fileButton.addEventListener('click', () => fileInput.click());
editor.getDomNode().appendChild(fileButton);

const hideFileButton = () => {
	currentFileFieldState = null;
	fileButton.style.display = 'none';
	fileValueDecorationIds = editor.deltaDecorations(fileValueDecorationIds, []);
};

const getFileFieldState = () => {
	const source = model.getValue();
	const fileEntryMatch = /"file"\s*:\s*("([^"\\]|\\.)*")/.exec(source);

	if (!fileEntryMatch) {
		return null;
	}

	const valueText = fileEntryMatch[1];
	const valueOffset = fileEntryMatch.index + fileEntryMatch[0].lastIndexOf(valueText);
	const valueStart = model.getPositionAt(valueOffset);
	const valueEnd = model.getPositionAt(valueOffset + valueText.length);

	return {
		hasValue: valueText !== '""',
		valueRange: new monaco.Range(
			valueStart.lineNumber,
			valueStart.column,
			valueEnd.lineNumber,
			valueEnd.column
		)
	};
};

const layoutFileButton = () => {
	if (!currentFileFieldState) {
		fileButton.style.display = 'none';
		return;
	}

	const visiblePosition = editor.getScrolledVisiblePosition({
		lineNumber: currentFileFieldState.valueRange.startLineNumber,
		column: currentFileFieldState.valueRange.startColumn
	});

	if (!visiblePosition) {
		fileButton.style.display = 'none';
		return;
	}

	fileButton.style.display = 'block';
	fileButton.style.left = `${visiblePosition.left}px`;
	fileButton.style.top = `${visiblePosition.top}px`;
	fileButton.style.height = `${Math.max(visiblePosition.height - 4, 20)}px`;
};

const showFileButton = (fileFieldState) => {
	currentFileFieldState = fileFieldState;
	fileButton.textContent = fileFieldState.hasValue ? 'Replace file' : 'Choose file';

	fileValueDecorationIds = editor.deltaDecorations(fileValueDecorationIds, [
		{
			range: fileFieldState.valueRange,
			options: {
				inlineClassName: 'file-value-hidden',
				inlineClassNameAffectsLetterSpacing: true
			}
		}
	]);

	layoutFileButton();
};

const syncFileButton = () => {
	try {
		const json = JSON.parse(model.getValue());

		if (!json || typeof json !== 'object' || Array.isArray(json) || !Object.prototype.hasOwnProperty.call(json, 'file')) {
			hideFileButton();
			return;
		}

		const fileFieldState = getFileFieldState();

		if (!fileFieldState) {
			hideFileButton();
			return;
		}

		showFileButton(fileFieldState);
	} catch {
		hideFileButton();
	}
};

const updateFileField = (nextValue) => {
	const json = JSON.parse(model.getValue());
	json.file = nextValue;
	model.setValue(`${JSON.stringify(json, null, 2)}\n`);
};

fileInput.addEventListener('change', async (event) => {
	const selectedFile = event.target.files && event.target.files[0];

	if (!selectedFile) {
		return;
	}

	const base64Value = await new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.addEventListener('load', () => {
			const result = reader.result;

			if (typeof result !== 'string') {
				reject(new Error('Unsupported file reader result.'));
				return;
			}

			resolve(result.split(',')[1] || '');
		});

		reader.addEventListener('error', () => {
			reject(reader.error || new Error('Unable to read the selected file.'));
		});

		reader.readAsDataURL(selectedFile);
	});

	updateFileField(base64Value);
	fileInput.value = '';
});

editor.onDidScrollChange(layoutFileButton);
editor.onDidLayoutChange(layoutFileButton);
model.onDidChangeContent(syncFileButton);
syncFileButton();
