/**
 * Replaceable surveillance attachments. Keep each image ID stable when replacing
 * a placeholder; update src and alt here if the file format or content changes.
 * Assets use a 1200 × 675 (16:9) frame. quality describes fictional link quality.
 */
export type ImageAttachment = {
  id: string;
  src: string;
  title: string;
  alt: string;
  camera: string;
  quality: number;
};

export const IMAGES: Record<string, ImageAttachment> = {
  IMG_01: {
    id: "IMG_01",
    src: "/images/IMG_01.svg",
    title: "第4研究区画",
    alt: "濡れた金属の床が奥の閉鎖扉へ続く、狭い第4研究区画。人影はない。",
    camera: "CAMERA-04",
    quality: 71,
  },
  IMG_02: {
    id: "IMG_02",
    src: "/images/IMG_02.svg",
    title: "浸水した通路",
    alt: "傾いた監視映像。赤い非常灯と配管の下、通路の床を海水が覆っている。",
    camera: "CAMERA-04B",
    quality: 52,
  },
  IMG_03: {
    id: "IMG_03",
    src: "/images/IMG_03.svg",
    title: "第2機械室",
    alt: "古い発電機と制御盤。物理スイッチのそばに数字入力端末がある。",
    camera: "CAMERA-02",
    quality: 78,
  },
  IMG_04: {
    id: "IMG_04",
    src: "/images/IMG_04.svg",
    title: "非常電源端末",
    alt: "非常電源端末に EMERGENCY POWER、AUTHORIZATION REQUIRED と表示されている。",
    camera: "TERMINAL-02",
    quality: 86,
  },
  IMG_05: {
    id: "IMG_05",
    src: "/images/IMG_05.svg",
    title: "水槽07監視映像",
    alt: "巨大な観測水槽のガラス。奥は暗く、内部に何があるか判別できない。",
    camera: "CAMERA-07",
    quality: 63,
  },
  IMG_06: {
    id: "IMG_06",
    src: "/images/IMG_06.svg",
    title: "水槽07・補正映像",
    alt: "明るさを補正した水槽07。空の水中に、反射とも人影とも取れる淡い模様がある。",
    camera: "CAMERA-07",
    quality: 42,
  },
  IMG_07: {
    id: "IMG_07",
    src: "/images/IMG_07.svg",
    title: "監視記録：17分前",
    alt: "事故17分前。水槽07の前に白衣姿の研究員が立っている。遠く、顔は見えない。",
    camera: "ARCHIVE-07",
    quality: 61,
  },
  IMG_08: {
    id: "IMG_08",
    src: "/images/IMG_08.svg",
    title: "監視記録：5分前",
    alt: "事故5分前。同じ水槽の前に研究員らしき人影。立ち位置と影が前の映像からわずかに変わっている。",
    camera: "ARCHIVE-07",
    quality: 38,
  },
  IMG_09: {
    id: "IMG_09",
    src: "/images/IMG_09.svg",
    title: "水槽07・隔離解除後",
    alt: "隔離が解除された水槽07。ガラスの向こうには静かな水だけが見える。",
    camera: "CAMERA-07",
    quality: 81,
  },
  IMG_10: {
    id: "IMG_10",
    src: "/images/IMG_10.svg",
    title: "未識別信号",
    alt: "ほぼ真っ黒の画像。中央の細かなノイズに、二つの淡い反射が見える。",
    camera: "UNKNOWN",
    quality: 7,
  },
};
