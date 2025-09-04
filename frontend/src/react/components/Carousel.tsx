import { PropsWithChildren } from "react";

interface Props extends PropsWithChildren {
  slideIndex: number;
  setSlideIndex: (updater: (i: number) => number) => void;
  maxIndex: number;
  visible?: number; // keeps API extensible; not used in render
}

export default function Carousel({ slideIndex, setSlideIndex, maxIndex, children }: Props) {
  const nodes = Array.isArray(children) ? children : [children];

  return (
    <div className="db-carousel" role="region" aria-label="Content carousel">
      <button
        className="db-nav db-nav--left"
        aria-label="Previous"
        onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
        disabled={slideIndex === 0}
      >
        ‹
      </button>

      <div className="db-viewport" aria-live="polite">
        <div
          className="db-track"
          // move strictly along the X axis by exactly one slide at a time
          style={{ transform: `translateX(calc((var(--slide-w) + var(--gap)) * -${slideIndex}))` }}
        >
          {nodes.map((node, idx) => (
            <div className="db-slide" key={idx}>
              {node}
            </div>
          ))}
        </div>
      </div>

      <button
        className="db-nav db-nav--right"
        aria-label="Next"
        onClick={() => setSlideIndex((i) => Math.min(maxIndex, i + 1))}
        disabled={slideIndex >= maxIndex}
      >
        ›
      </button>
    </div>
  );
}
