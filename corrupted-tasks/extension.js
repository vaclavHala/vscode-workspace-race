//@ts-check
const os = require("os")
const fs = require("fs")
const path = require("path")
const vscode = require('vscode');
function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('corrupted-tasks.helloWorld', crunchTaskJsonWrite),
        vscode.tasks.registerTaskProvider("myprovider", {
            async provideTasks() {
                // await new Promise(r => setTimeout(r, 500))
                return []
            },
            async resolveTask(t) {
                // await new Promise(r => setTimeout(r, 500))
                return new vscode.Task(
                    t.definition, t.scope ?? vscode.TaskScope.Global, t.name, t.source,
                    new vscode.ShellExecution(`sleep 10`)
                )
            }
        })
    )
}

async function crunchTaskJsonWrite() {
    const initial = vscode.workspace.workspaceFolders
    if (!initial || initial.length != 2) {
        throw new Error("Run this with workspace containing 2 folders")
    }

    const tmpFolder = path.resolve(os.tmpdir(), "corrupted-tasks")
    const tmpUri = vscode.Uri.file(tmpFolder)

    while (true) {
        console.log("Create tmp")
        fs.mkdirSync(tmpFolder, { recursive: true })
        await updateWorkspaceAndWait(2, 0, [{ uri: tmpUri }]);

        console.log("Write tasks 1")
        await writeTasksFile(tmpUri,
            { label: "mytask1", type: "myprovider", myprops: {myprop: "foo" } },
            { label: "mytask2", type: "myprovider", myprops: {myprop: "bar" } },
        )
        console.log("Run task")
        await runTaskTerminateAndAwaitDone("mytask1")
        await runTaskTerminateAndAwaitDone("mytask2")

        console.log("Remove tmp")
        await updateWorkspaceAndWait(2, 1, [])
        fs.rmSync(tmpFolder, { recursive: true })
    }
}

function updateWorkspaceAndWait(start, deleteCount, workspaceFoldersToAdd) {
    const succ = vscode.workspace.updateWorkspaceFolders(start, deleteCount, ...workspaceFoldersToAdd)
    if (succ) {
        const disps = []
        return new Promise(resolve => {
            vscode.workspace.onDidChangeWorkspaceFolders(e => {
                resolve(null);
            }, null, disps);
        }).finally(() => disps.forEach(disp => disp.dispose()));
    } else {
        return Promise.reject(new Error("Failed to update workspace"))
    }
}

async function writeTasksFile(projectUri, ...tasks) {
    await vscode.workspace.fs.writeFile(
        vscode.Uri.joinPath(projectUri, '.vscode', 'tasks.json'),
        Buffer.from(JSON.stringify({ "version": "2.0.0", "tasks": tasks }, null, 2)))
    let actuals = []
    for (let attempt = 0; attempt < 10; attempt += 1) {
        actuals = (await vscode.tasks.fetchTasks()).map(task => task.name)
        if (tasks.every(expected => actuals.includes(expected.label))) {
            return
        }
        await new Promise(r => setTimeout(r, 500))
    }
    throw new Error(`Task system did not load tasks from the tasks file in time. Latest fetchTasks() result:\n${actuals.join("\n")}`)
}

async function runTaskTerminateAndAwaitDone(taskName) {

    const task = (await vscode.tasks.fetchTasks({type: "myprovider"})).filter(task => task.name === taskName)[0]

    return new Promise((resolve, reject) => {
        vscode.tasks.onDidEndTask(taskEnded => {
            if (taskEnded.execution.task === task) {
                resolve(null)
            }
        })

        vscode.tasks.executeTask(task).then(
            exec => {
                console.log("Task started")
                setTimeout(() => {
                    console.log("calling terminate()")
                    exec.terminate()
                }, 500)
            },
            err => reject(err)
        )
    })
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
