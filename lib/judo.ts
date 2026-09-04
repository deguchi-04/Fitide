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
  videoId: string;
}

const technique = (
  id: string,
  name: string,
  japanese: string,
  category: JudoCategory,
  videoId: string,
): JudoTechnique => ({ id, name, japanese, category, videoId });

// Nomes e classificação seguem o catálogo oficial do Kodokan/IJF.
export const judoTechniques: JudoTechnique[] = [
  technique('seoi-nage', 'Seoi-nage', '背負投', 'Te-waza', 'zIq0xI0ogxk'),
  technique('ippon-seoi-nage', 'Ippon-seoi-nage', '一本背負投', 'Te-waza', 'FQnOlCxo4oI'),
  technique('seoi-otoshi', 'Seoi-otoshi', '背負落', 'Te-waza', 'vu1TMVNnq34'),
  technique('tai-otoshi', 'Tai-otoshi', '体落', 'Te-waza', '4x6S3Q-Ktv8'),
  technique('kata-guruma', 'Kata-guruma', '肩車', 'Te-waza', 'cnHRhSy8yi4'),
  technique('sumi-otoshi', 'Sumi-otoshi', '隅落', 'Te-waza', 'lLU9wv52ni0'),
  technique('uki-goshi', 'Uki-goshi', '浮腰', 'Koshi-waza', 'bPKwtB4lyOQ'),
  technique('o-goshi', 'O-goshi', '大腰', 'Koshi-waza', 'yhu1mfy2vJ4'),
  technique('harai-goshi', 'Harai-goshi', '払腰', 'Koshi-waza', 'qTo8HlAAkOo'),
  technique('tsuri-komi-goshi', 'Tsuri-komi-goshi', '釣込腰', 'Koshi-waza', 'McfzA0yRVt4'),
  technique('utsuri-goshi', 'Utsuri-goshi', '移腰', 'Koshi-waza', '4pQd_bEnlf0'),
  technique('o-soto-gari', 'O-soto-gari', '大外刈', 'Ashi-waza', 'c-A_nP7mKAc'),
  technique('o-uchi-gari', 'O-uchi-gari', '大内刈', 'Ashi-waza', '0itJFhV9pDQ'),
  technique('ko-uchi-gari', 'Ko-uchi-gari', '小内刈', 'Ashi-waza', '3Jb3tZvr9Ng'),
  technique('de-ashi-harai', 'De-ashi-harai', '出足払', 'Ashi-waza', '4BUUvqxi_Kk'),
  technique('okuri-ashi-harai', 'Okuri-ashi-harai', '送足払', 'Ashi-waza', 'nw1ZdRjrdRI'),
  technique('sasae-tsurikomi-ashi', 'Sasae-tsurikomi-ashi', '支釣込足', 'Ashi-waza', '699i--pvYmE'),
  technique('uchi-mata', 'Uchi-mata', '内股', 'Ashi-waza', 'iUpSu5J-bgw'),
  technique('tomoe-nage', 'Tomoe-nage', '巴投', 'Sutemi-waza', '880WbHvHv6A'),
  technique('sumi-gaeshi', 'Sumi-gaeshi', '隅返', 'Sutemi-waza', '5VhduA5xkbA'),
  technique('ura-nage', 'Ura-nage', '裏投', 'Sutemi-waza', 'Fgi9b8DJ5sQ'),
  technique('yoko-otoshi', 'Yoko-otoshi', '横落', 'Sutemi-waza', 'MnNG67pF_a0'),
  technique('tani-otoshi', 'Tani-otoshi', '谷落', 'Sutemi-waza', '3b9Me3Fohpk'),
  technique('kesa-gatame', 'Kesa-gatame', '袈裟固', 'Osaekomi-waza', 'NDaQuJOFBYk'),
  technique('yoko-shiho-gatame', 'Yoko-shiho-gatame', '横四方固', 'Osaekomi-waza', 'TT7XJVSEQxA'),
  technique('kami-shiho-gatame', 'Kami-shiho-gatame', '上四方固', 'Osaekomi-waza', 'HFuMjOv0WN8'),
  technique('kata-juji-jime', 'Kata-juji-jime', '片十字絞', 'Shime-waza', '3VZVUAmiMD8'),
  technique('hadaka-jime', 'Hadaka-jime', '裸絞', 'Shime-waza', '9f0n8jez7iA'),
  technique('okuri-eri-jime', 'Okuri-eri-jime', '送襟絞', 'Shime-waza', 'EiqyoVcIAi8'),
  technique('ude-hishigi-juji-gatame', 'Ude-hishigi-juji-gatame', '腕挫十字固', 'Kansetsu-waza', 'OWgSOlCuMXw'),
  technique('ude-garami', 'Ude-garami', '腕緘', 'Kansetsu-waza', 'AIlTvZb4RlE'),
];

export const KODOKAN_TECHNIQUES_URL =
  'https://kdkjudo.org/%E6%8A%80/%E6%9F%94%E9%81%93-%E6%8A%80%E5%90%8D%E7%A7%B0%E4%B8%80%E8%A6%A7/';
export const KODOKAN_DEFINITIONS_URL =
  'https://kdkjudo.org/wp-content/uploads/2024/07/Kodokan-Definitions-of-Judo-Techniques-01.10.2022.pdf';

export function ijfTechniqueUrl(id: string) {
  return `https://judo.ijf.org/techniques/${id}`;
}
