"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const path = require("path");
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
let client;
function activate(context) {
    // 服务器由node实现
    // Server 模块的入口文件
    const serverModule = context.asAbsolutePath(path.join('lsp', 'server', 'out', 'server.js'));
    // 为服务器提供debug选项
    // --inspect=6009: 运行在Node's Inspector mode，这样VS Code就能调试服务器了
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    // 如果插件运行在调试模式那么就会使用debug server options
    // 不然就使用run options
    const serverOptions = {
        run: {
            module: serverModule,
            // 通讯协议，支持 stdio、ipc、pipe、socket
            transport: node_1.TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    // 控制语言客户端的选项
    const clientOptions = {
        // 与 packages.json 文件的 activationEvents 类似
        // 插件的激活条件
        documentSelector: [{ scheme: 'file', language: 'cna' }],
        synchronize: {
            // 当文件变动为'.clientrc'中那样时，通知服务器
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    // 创建语言客户端并启动
    client = new node_1.LanguageClient('languageServerExample', 'Language Server Example', serverOptions, clientOptions);
    //启动client，同时会启动server
    client.start();
}
exports.activate = activate;
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map