import { publicPath } from '../../siteConfig';
import { toyCharacters } from '../../data/toyCharacters';
import type { GachaState } from './gachaState';
import styles from './toys.module.css';

export default function ToyCollection({ collection }: { collection: GachaState['collection'] }) {
  return <>
    <p className={styles.dialogDescription}>已经遇见 {Object.keys(collection).length} 位伙伴。重复抽到的角色也会好好收藏。</p>
    <div className={styles.characterGrid}>{toyCharacters.map(character => {
      const count = collection[character.id] || 0;
      return <div key={character.id} className={`${styles.characterCard} ${!count ? styles.undiscovered : ''}`} data-collected={!!count}>
        <div className={styles.characterArt} style={{ backgroundColor: `${character.color}28` }}><img src={publicPath(`/toys/characters/${character.id}.webp`)} alt={count ? character.name : `${character.name}，尚未收集`} loading="lazy" /></div>
        <strong>{character.name}</strong><span>{count ? `已收藏 ×${count}` : '尚未遇见'}</span>
      </div>;
    })}</div>
  </>;
}
