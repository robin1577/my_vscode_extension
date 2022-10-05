/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	HoverParams,
	Hover,
	SignatureHelpParams,
	SignatureHelp
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

// 创建一个服务器连接。使用Node的IPC作为传输方式。
// 也包含所有的预览、建议等LSP特性
// 要素1： 初始化 LSP 连接对象
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
//要素2： 创建文档集合对象，用于映射到客户端正在编辑的文件
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

//lsp连接对象初始化
connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// 客户端是否支持`workspace/configuration`请求?
    // 如果不是的话，降级到使用全局设置
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);
	// 要素3： 显式声明插件支持的语言特性
	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			//鼠标悬停功能开启
			//hoverProvider: true
			/*代码补全功能
			completionProvider: {
                resolveProvider: true
            }*/

			//函数签名
			signatureHelpProvider: {
				triggerCharacters:["("]
			}
		}
		
	};

	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});
//悬停提示和绑定
connection.onHover((params: HoverParams): Promise<Hover> => {
  return Promise.resolve({
    contents: ["Hover Demo"],
  });
});
//函数签名实现和绑定
connection.onSignatureHelp(
  (params: SignatureHelpParams): Promise<SignatureHelp> => {
    return Promise.resolve({
      signatures: [
        {
          label: "Signature Demo",
          documentation: "帮助文档",
          parameters: [
            {
              label: "@p1 first param",
              documentation: "参数说明",
            },
          ],
        },
      ],
      activeSignature: 0,
      activeParameter: 0,
    });
  }
);

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// 当客户端不支持`workspace/configuration`请求时，使用global settings
// 请注意，在这个例子中服务器使用的客户端并不是问题所在，而是这种情况还可能发生在其他客户端身上。
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});


function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}
// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

/*
// 文档的文本内容发生了改变。
// 这个事件在文档第一次打开或者内容变动时才会触发。
//增加错误诊断
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});
*/

//这段逻辑诊断代码中是否存在连续大写字符串，通过 `sendDiagnostics` 发送相应的错误信息
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	const pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: 'ex'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Spelling matters'
				},
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Particularly for names'
				}
			];
		}
		diagnostics.push(diagnostic);
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// 这个处理函数提供了初始补全项列表
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // 传入的变量包含了文本请求代码补全的位置。
    // 在这个示例中我们忽略了这个信息，总是提供相同的补全选项。
    return [
        {
            label: 'TypeScript',
            kind: CompletionItemKind.Text,
            data: 1
        },
        {
            label: 'JavaScript',
            kind: CompletionItemKind.Text,
            data: 2
        }
        ];
    }
);

// 这个函数为补全列表的选中项提供了更多信息
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
//// 要素4： 将文档集合对象关联到连接对象
documents.listen(connection);

// Listen on the connection
//// 要素5： 开始监听连接对象
connection.listen();
