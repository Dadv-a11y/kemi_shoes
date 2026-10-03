"use client";

import Image from "next/image";
import { useState } from "react";

/** Galerie de la fiche produit : toutes les photos du produit, vignettes cliquables. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  return (
    <>
      <div className="product-main-image">
        <Image src={images[active]} alt={name} fill priority sizes="(max-width: 768px) 100vw, 55vw" />
        <span className="gallery-caption">Photo produit — vue {active + 1}</span>
        {images.length > 1 && <span className="gallery-dots">{images.map((image, index) => <i key={image} className={index === active ? "active" : undefined} />)}</span>}
      </div>
      <div className="product-thumbnails">
        {images.map((image, index) => (
          <button type="button" className={`product-thumbnail ${index === active ? "active" : ""}`} key={image} aria-label={`Vue ${index + 1} de ${name}`} aria-pressed={index === active} onClick={() => setActive(index)}>
            <Image src={image} alt="" fill sizes="84px" />
          </button>
        ))}
      </div>
    </>
  );
}
