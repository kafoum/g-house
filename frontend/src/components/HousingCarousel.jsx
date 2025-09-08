import React from 'react';
import Slider from 'react-slick';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import './HousingCarousel.css';

const HousingCarousel = ({ housings }) => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    pauseOnHover: true,
  };

  return (
    <div className="carousel-container">
      <Slider {...settings}>
        {housings.map((housing, index) => (
          <div key={index} className="slide-item">
            <img src={housing.images[0]} alt={housing.title} className="slide-image" />
            <div className="slide-info">
              <h3>{housing.title}</h3>
              <p>{housing.price} € par mois</p>
            </div>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default HousingCarousel;