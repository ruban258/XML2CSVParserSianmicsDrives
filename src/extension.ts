import * as vscode from "vscode";
import * as xml2js from "xml2js";
import * as fs from "fs";
import * as path from "path";

interface AlarmData {
  Number: string;
  Type: string;
  LongName?: string;
  ShortName?: string;
  MsgClass?: string;
  Cause?: string;
  Remedy?: string;
  nr?: string;
}

export function activate(context: vscode.ExtensionContext) {
  console.log("XML Parser Drives extension is now active");

  let disposable = vscode.commands.registerCommand(
    "xmlParserDrives.makeAlarmList",
    async () => {
      try {
        // Get active editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage("No active editor found");
          return;
        }

        // Get document content
        const document = editor.document;
        const xmlContent = document.getText();

        // Parse XML with Promise wrapper
        const parser = new xml2js.Parser({
          explicitArray: false,
          mergeAttrs: true,
        });

        try {
          const result = await parser.parseStringPromise(xmlContent);
          const alarms: AlarmData[] = [];

          // Extract SINAMICSAlarm nodes
          if (
            result.SINAMICSAlarmList &&
            result.SINAMICSAlarmList.SINAMICSAlarm
          ) {
            const alarmNodes = Array.isArray(
              result.SINAMICSAlarmList.SINAMICSAlarm
            )
              ? result.SINAMICSAlarmList.SINAMICSAlarm
              : [result.SINAMICSAlarmList.SINAMICSAlarm];

            // Process each alarm
            alarmNodes.forEach((alarm: any) => {
              if (alarm.Number && alarm.Type !== undefined) {
                const alarmData: AlarmData = {
                  Number: alarm.Number,
                  Type: alarm.Type,
                  LongName: alarm.LongName,
                  ShortName: alarm.ShortName,
                  MsgClass: alarm.MsgClass?._,
                  Cause: alarm.Cause?._,
                  Remedy: alarm.Remedy?._,
                  nr: alarm.nr,
                };
                alarms.push(alarmData);
              }
            });

            // Show success and count
            vscode.window.showInformationMessage(
              `Successfully parsed ${alarms.length} alarms`
            );

            // Create CSV content
            const header =
              "nr,Number,Type,Description,ShortName,MsgClass,Cause,Remedy\n";
            const csvRows = alarms.map((alarm) => {
              const description = `${alarm.Number}${
                alarm.LongName ? ` - ${alarm.LongName}` : ""
              }`;
              return [
                alarm.nr,
                alarm.Number,
                alarm.Type,
                description, // New concatenated field
                alarm.ShortName || "",
                alarm.MsgClass || "",
                alarm.Cause || "",
                alarm.Remedy || "",
              ]
                .map((field) => `"${String(field || "").replace(/"/g, '""')}"`)
                .join(",");
            });

            const csvContent = header + csvRows.join("\n");

            // Show save dialog
            const saveUri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(
                path.join(vscode.workspace.rootPath || "", "alarms.csv")
              ),
              filters: {
                "CSV files": ["csv"],
                "All files": ["*"],
              },
            });

            if (saveUri) {
              try {
                fs.writeFileSync(saveUri.fsPath, csvContent);
                vscode.window.showInformationMessage(
                  `Successfully saved ${alarms.length} alarms to ${saveUri.fsPath}`
                );
              } catch (err) {
                vscode.window.showErrorMessage(
                  `Failed to save CSV file: ${
                    err instanceof Error ? err.message : "Unknown error"
                  }`
                );
              }
            }
          }
        } catch (parseError: any) {
          vscode.window.showErrorMessage(
            `Failed to parse XML: ${parseError.message}`
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
