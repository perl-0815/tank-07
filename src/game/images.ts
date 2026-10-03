/**
 * Replaceable surveillance attachments. Keep each image ID stable when replacing
 * an asset; update its path, dimensions and alt text here as needed.
 * quality describes fictional link quality, not image encoding quality.
 */
export type ImageAttachment = {
  id: string;
  src: string;
  width: number;
  height: number;
  title: string;
  alt: string;
  camera: string;
  quality: number;
};

export const IMAGES: Record<string, ImageAttachment> = {
  IMG_01: {
    id: "IMG_01",
    src: "/images/research-section-04.webp",
    width: 1672,
    height: 941,
    title: "第4研究区画",
    alt: "濡れた金属の床が奥の閉鎖扉へ続く、狭い第4研究区画。人影はない。",
    camera: "CAMERA-04",
    quality: 71,
  },
  IMG_02: {
    id: "IMG_02",
    src: "/images/flooded-corridor.webp",
    width: 1672,
    height: 941,
    title: "浸水した通路",
    alt: "配管に囲まれた通路を海水が覆い、赤い非常灯が水面に反射している。",
    camera: "CAMERA-04B",
    quality: 52,
  },
  IMG_03: {
    id: "IMG_03",
    src: "/images/machine-room-02.webp",
    width: 1672,
    height: 941,
    title: "第2機械室",
    alt: "古い発電機と制御盤。物理スイッチのそばに数字入力端末がある。",
    camera: "CAMERA-02",
    quality: 78,
  },
  IMG_04: {
    id: "IMG_04",
    src: "/images/emergency-power-terminal.webp",
    width: 1672,
    height: 941,
    title: "非常電源端末",
    alt: "薄暗い機械室に設置された非常電源端末。橙色の画面と入力盤が光っている。",
    camera: "TERMINAL-02",
    quality: 86,
  },
  IMG_05: {
    id: "IMG_05",
    src: "/images/tank-07-surveillance.webp",
    width: 1672,
    height: 941,
    title: "水槽07監視映像",
    alt: "巨大な観測水槽のガラス。奥は暗く、内部に何があるか判別できない。",
    camera: "CAMERA-07",
    quality: 63,
  },
  IMG_06: {
    id: "IMG_06",
    src: "/images/tank-07-anomaly.webp",
    width: 1672,
    height: 941,
    title: "水槽07・補正映像",
    alt: "赤く照らされた水槽07。水中の暗がりに輪郭のはっきりしない影が浮かぶ。",
    camera: "CAMERA-07",
    quality: 42,
  },
  IMG_07: {
    id: "IMG_07",
    src: "/images/yuna-surveillance.webp",
    width: 1672,
    height: 941,
    title: "監視記録：17分前",
    alt: "事故17分前。水槽07の前に白衣姿の研究員が立っている。遠く、顔は見えない。",
    camera: "ARCHIVE-07",
    quality: 61,
  },
  IMG_08: {
    id: "IMG_08",
    src: "/images/surveillance-anomaly.webp",
    width: 1672,
    height: 941,
    title: "監視記録：5分前",
    alt: "事故5分前。研究員らしき人影が赤い水槽の前に立ち、水中には前の映像にない暗い筋が見える。",
    camera: "ARCHIVE-07",
    quality: 38,
  },
  IMG_09: {
    id: "IMG_09",
    src: "/images/tank-07-empty.webp",
    width: 1672,
    height: 941,
    title: "水槽07・隔離解除後",
    alt: "研究員が見つめる水槽07。青白い光の下、ガラスの向こうには静かな水と空の床面が見える。",
    camera: "CAMERA-07",
    quality: 81,
  },
  IMG_10: {
    id: "IMG_10",
    src: "/images/true-ending-signal.webp",
    width: 1672,
    height: 941,
    title: "未識別信号",
    alt: "赤い光と粗い粒子に覆われた水槽の映像。中央の暗がりに、輪郭の曖昧な形が重なっている。",
    camera: "UNKNOWN",
    quality: 7,
  },
};
