export default function ListItemArtwork({ item, hideName = false }) {
  const imgUrl = item.image_url || item.cover_url || item.cover?.url
  return <div className="cl-item">
    {imgUrl && <img src={imgUrl} alt={item.name}/>}
    {!imgUrl && hideName && <span className="cl-ranking-cover-fallback">{item.name?.charAt(0)}</span>}
    {!hideName && <div className="cl-item-overlay"><span className="cl-item-name">{item.name}</span></div>}
  </div>
}
