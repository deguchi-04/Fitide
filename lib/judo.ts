export type JudoCategory =
  | 'Te-waza'
  | 'Koshi-waza'
  | 'Ashi-waza'
  | 'Sutemi-waza'
  | 'Osaekomi-waza'
  | 'Shime-waza'
  | 'Kansetsu-waza';

export interface JudoTechnique {
  id: string;
  name: string;
  japanese: string;
  category: JudoCategory;
}

const technique = (
  id: string,
  name: string,
  japanese: string,
  category: JudoCategory,
): JudoTechnique => ({ id, name, japanese, category });

// Nomes e classificação seguem o catálogo oficial do Kodokan/IJF.
export const judoTechniques: JudoTechnique[] = [
  technique('seoi-nage', 'Seoi-nage', '背負投', 'Te-waza'),
  technique('ippon-seoi-nage', 'Ippon-seoi-nage', '一本背負投', 'Te-waza'),
  technique('seoi-otoshi', 'Seoi-otoshi', '背負落', 'Te-waza'),
  technique('tai-otoshi', 'Tai-otoshi', '体落', 'Te-waza'),
  technique('kata-guruma', 'Kata-guruma', '肩車', 'Te-waza'),
  technique('sumi-otoshi', 'Sumi-otoshi', '隅落', 'Te-waza'),
  technique('uki-goshi', 'Uki-goshi', '浮腰', 'Koshi-waza'),
  technique('o-goshi', 'O-goshi', '大腰', 'Koshi-waza'),
  technique('harai-goshi', 'Harai-goshi', '払腰', 'Koshi-waza'),
  technique('tsuri-komi-goshi', 'Tsuri-komi-goshi', '釣込腰', 'Koshi-waza'),
  technique('utsuri-goshi', 'Utsuri-goshi', '移腰', 'Koshi-waza'),
  technique('o-soto-gari', 'O-soto-gari', '大外刈', 'Ashi-waza'),
  technique('o-uchi-gari', 'O-uchi-gari', '大内刈', 'Ashi-waza'),
  technique('ko-uchi-gari', 'Ko-uchi-gari', '小内刈', 'Ashi-waza'),
  technique('de-ashi-harai', 'De-ashi-harai', '出足払', 'Ashi-waza'),
  technique('okuri-ashi-harai', 'Okuri-ashi-harai', '送足払', 'Ashi-waza'),
  technique('sasae-tsurikomi-ashi', 'Sasae-tsurikomi-ashi', '支釣込足', 'Ashi-waza'),
  technique('uchi-mata', 'Uchi-mata', '内股', 'Ashi-waza'),
  technique('tomoe-nage', 'Tomoe-nage', '巴投', 'Sutemi-waza'),
  technique('sumi-gaeshi', 'Sumi-gaeshi', '隅返', 'Sutemi-waza'),
  technique('ura-nage', 'Ura-nage', '裏投', 'Sutemi-waza'),
  technique('yoko-otoshi', 'Yoko-otoshi', '横落', 'Sutemi-waza'),
  technique('tani-otoshi', 'Tani-otoshi', '谷落', 'Sutemi-waza'),
  technique('kesa-gatame', 'Kesa-gatame', '袈裟固', 'Osaekomi-waza'),
  technique('yoko-shiho-gatame', 'Yoko-shiho-gatame', '横四方固', 'Osaekomi-waza'),
  technique('kami-shiho-gatame', 'Kami-shiho-gatame', '上四方固', 'Osaekomi-waza'),
  technique('kata-juji-jime', 'Kata-juji-jime', '片十字絞', 'Shime-waza'),
  technique('hadaka-jime', 'Hadaka-jime', '裸絞', 'Shime-waza'),
  technique('okuri-eri-jime', 'Okuri-eri-jime', '送襟絞', 'Shime-waza'),
  technique('ude-hishigi-juji-gatame', 'Ude-hishigi-juji-gatame', '腕挫十字固', 'Kansetsu-waza'),
  technique('ude-garami', 'Ude-garami', '腕緘', 'Kansetsu-waza'),
];

export const KODOKAN_TECHNIQUES_URL =
  'https://kdkjudo.org/%E6%8A%80/%E6%9F%94%E9%81%93-%E6%8A%80%E5%90%8D%E7%A7%B0%E4%B8%80%E8%A6%A7/';
export const KODOKAN_DEFINITIONS_URL =
  'https://kdkjudo.org/wp-content/uploads/2024/07/Kodokan-Definitions-of-Judo-Techniques-01.10.2022.pdf';

export function ijfTechniqueUrl(id: string) {
  return `https://judo.ijf.org/techniques/${id}`;
}
