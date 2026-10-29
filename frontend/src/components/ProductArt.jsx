/** The product "photo": a colour block with the product emoji standing on a soft floor shadow. */
export default function ProductArt({ product, size = "card", children }) {
  const style = { "--art-bg": product.color || "#E8ECF5" };
  return (
    <div className={`art art-${size}`} style={style}>
      {product.image_url ? (
        <img src={product.image_url} alt="" loading="lazy" />
      ) : (
        <span className="art-emoji" role="img" aria-label={product.name}>
          {product.emoji}
        </span>
      )}
      {children}
    </div>
  );
}
