import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

const SLIDE_IMAGES = [
  {
    url: '/assets/images/dashboard/slider1.png',
    title: '혁신적인 스마트 건설 솔루션',
    description: '청연ENG는 최첨단 기술로 건설 현장의 안전과 효율을 혁신합니다.'
  },
  {
    url: '/assets/images/dashboard/slider2.png',
    title: '전국 단위 건설 인력 네트워크',
    description: '신뢰 기반의 파트너십으로 대규모 프로젝트의 성공을 이끕니다.'
  },
  {
    url: '/assets/images/dashboard/slider3.png',
    title: '비계 및 시스템 동바리 시공의 중심',
    description: '최고의 기술력과 장비 임대 운영 역량으로 완벽한 시공을 보장합니다.'
  }
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0
  })
};

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export const DashboardSlider: React.FC = () => {
  const [[page, direction], setPage] = useState([0, 0]);
  const [isHovered, setIsHovered] = useState(false);

  const imageIndex = ((page % SLIDE_IMAGES.length) + SLIDE_IMAGES.length) % SLIDE_IMAGES.length;

  const paginate = useCallback((newDirection: number) => {
    setPage([page + newDirection, newDirection]);
  }, [page]);

  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      paginate(1);
    }, 5000);
    return () => clearInterval(timer);
  }, [paginate, isHovered]);

  return (
    <div 
      className="relative w-full h-[400px] md:h-[500px] overflow-hidden bg-slate-900 rounded-3xl border border-white/10 shadow-2xl group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={page}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.5 }
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);

            if (swipe < -swipeConfidenceThreshold) {
              paginate(1);
            } else if (swipe > swipeConfidenceThreshold) {
              paginate(-1);
            }
          }}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        >
          <div 
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${SLIDE_IMAGES[imageIndex].url})` }}
          >
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-transparent" />
            
            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-center px-12 md:px-20 max-w-3xl">
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight drop-shadow-lg"
              >
                {SLIDE_IMAGES[imageIndex].title}
              </motion.h2>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-lg md:text-xl text-slate-200 font-light leading-relaxed drop-shadow-md"
              >
                {SLIDE_IMAGES[imageIndex].description}
              </motion.p>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="mt-8"
              >
                <button className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-bold transition-all shadow-lg shadow-amber-500/30">
                  자세히 보기
                </button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <button
        className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all hover:bg-white/20 z-10 opacity-0 group-hover:opacity-100"
        onClick={() => paginate(-1)}
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>
      <button
        className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all hover:bg-white/20 z-10 opacity-0 group-hover:opacity-100"
        onClick={() => paginate(1)}
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>

      {/* Pagination Dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {SLIDE_IMAGES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setPage([idx, idx > imageIndex ? 1 : -1])}
            className={`w-2.5 h-2.5 rounded-full transition-all ${idx === imageIndex ? 'bg-amber-500 w-8' : 'bg-white/40 hover:bg-white/60'}`}
          />
        ))}
      </div>
    </div>
  );
};
