const vscode = require('vscode');
function activate(context) {
    let disposable = vscode.commands.registerCommand('workspace-race.helloWorld', crunchWorkspaceUpdate);
    context.subscriptions.push(disposable);
}

async function crunchWorkspaceUpdate(){
    const initial = vscode.workspace.workspaceFolders
    if(!initial || initial.length != 3){
        throw new Error("Run this with workspace containing 3 folders")
    }

    const third = initial[2].uri

    while(true){
        const ws1 = vscode.workspace.workspaceFolders
        console.log(`1: [${ws1.map(f=>f.name)}]`)
        if(ws1.length !== 3){
            throw new Error("Unexpected workspace folders, see log")
        }
        await updateWorkspaceAndWait(2, 1, []);
        
        const ws2 = vscode.workspace.workspaceFolders
        console.log(`2: [${ws2.map(f=>f.name)}]`)
        if(ws2.length !== 2){
            throw new Error("Unexpected workspace folders, see log")
        }
        await updateWorkspaceAndWait(2, 0, [{uri: third}]);
    }
}

function updateWorkspaceAndWait(start, deleteCount, workspaceFoldersToAdd) {
    const succ = vscode.workspace.updateWorkspaceFolders(start, deleteCount, ...workspaceFoldersToAdd)
    if (succ) {
        const disps = []
        return new Promise(resolve => {
            // updateWorkspaceFolders requires we wait for onDidChangeWorkspaceFolders before changing workspace again
            // so we have to always wait in case the test tries to add multiple folders in succession
            vscode.workspace.onDidChangeWorkspaceFolders(e => {
                resolve();
            }, null, disps);
        }).finally(() => disps.forEach(disp => disp.dispose()));
    } else {
        return Promise.reject(new Error("Failed to update workspace"))
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
