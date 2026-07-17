export interface FolderPickerFile {
  name: string;
  uri: string;
  mimeType: string;
  size: number;
}

export interface FolderPickerResult {
  name: string;
  uri: string;
  files: FolderPickerFile[];
}

export interface FolderPickerPlugin {
  pickFolder(): Promise<FolderPickerResult>;
  /**
   * Delete a file by SAF URI. Requires that the URI belongs to a tree
   * previously granted via `pickFolder()`.
   */
  deleteFile(options: { uri: string }): Promise<void>;
  /**
   * Physically rename a file on disk by SAF URI. The `newName` MUST include
   * the extension. Returns the new SAF URI and the effective display name
   * (some providers sanitize the requested name).
   */
  renameFile(options: {
    uri: string;
    newName: string;
  }): Promise<{ uri: string; name: string }>;
}

export declare const FolderPicker: FolderPickerPlugin;
export default FolderPicker;
