export interface TextDrawData {
  id: number;
  string: string;
  pos: [number, number];
  letterSize: [number, number];
  textSize: [number, number];
  alignment: number;
  color: number;
  useBox: number;
  boxColor: number;
  shadow: number;
  outline: number;
  bgColor: number;
  font: number;
  proportional: number;
  selectable: number;
  previewModel: number;
  previewRot: [number, number, number, number];
  previewVc: [number, number];
  globalPlayer: number;
  varName: string;
  group: number;
}

export interface ProjectData {
  name: string;
  hour: number;
  hudY: number;
  globalName: string;
  playerName: string;
}
