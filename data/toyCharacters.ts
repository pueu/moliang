export const toyCharacters = [
  { id: 'kirby', name: '卡比', series: '星之卡比', color: '#ef8eae', description: '把今天的小小快乐，一口收藏。' },
  { id: 'waddle-dee', name: '瓦豆鲁迪', series: '星之卡比', color: '#e8a165', description: '慢慢走，也会遇到好事情。' },
  { id: 'dedede', name: '帝帝帝大王', series: '星之卡比', color: '#78a5d2', description: '今天也要有大王一样的气场。' },
  { id: 'meta-knight', name: '魅塔骑士', series: '星之卡比', color: '#9795d7', description: '给平凡的一天，加一点冒险。' },
  { id: 'mario', name: '马力欧', series: '超级马力欧', color: '#e88787', description: '准备好，去发现下一关！' },
  { id: 'luigi', name: '路易吉', series: '超级马力欧', color: '#91b787', description: '有一点紧张，也可以很勇敢。' },
  { id: 'yoshi', name: '耀西', series: '超级马力欧', color: '#86bda1', description: '和喜欢的伙伴，一起出发。' },
  { id: 'donkey-kong', name: '森喜刚', series: '森喜刚', color: '#bb987d', description: '给自己留一点痛快玩耍的时间。' },
] as const;
export type ToyCharacterId = typeof toyCharacters[number]['id'];
