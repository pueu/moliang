"use client";
import { siteConfig } from '../siteConfig';

export default function BackgroundSlider() {
  return (
    <div className="absolute inset-0 z-[-10] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${siteConfig.bgImages[0]})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
    </div>
  );
}
