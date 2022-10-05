/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {

	// 服务器由node实现
	// Server 模块的入口文件
	const serverModule = context.asAbsolutePath(
		path.join('lsp','server', 'out', 'server.js')
	);

	// 为服务器提供debug选项
    // --inspect=6009: 运行在Node's Inspector mode，这样VS Code就能调试服务器了
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// 如果插件运行在调试模式那么就会使用debug server options
    // 不然就使用run options
	const serverOptions: ServerOptions = {
		run: {
			
			module: serverModule,
			// 通讯协议，支持 stdio、ipc、pipe、socket
			transport: TransportKind.ipc
		},
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// 控制语言客户端的选项
	const clientOptions: LanguageClientOptions = {

		// 与 packages.json 文件的 activationEvents 类似
        // 插件的激活条件
		documentSelector: [{ scheme: 'file', language: 'cna' }],
		synchronize: {
			// 当文件变动为'.clientrc'中那样时，通知服务器
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// 创建语言客户端并启动
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);
	
	//启动client，同时会启动server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
