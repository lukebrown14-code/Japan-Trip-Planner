export interface JourneyEditorProps {
  journeyKey: string;
  onSaved: () => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}
