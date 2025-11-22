// Check if slider element exists before initializing
const sliderElement = document.querySelector('#slider-testimoinials');

if (!sliderElement) {
  // Exit silently if slider element doesn't exist on this page
  console.log('[Slider] Slider element not found, skipping initialization');
} else {
  // Initialize the Splide slider
  const slider = new Splide('#slider-testimoinials', {

    type: 'loop',

    gap: 16,

    pagination: false,

    autoWidth: true,

    autoplay: true, // Enable autoplay

    interval: 3000, // 3 seconds

    pauseOnHover: true, // Pause autoplay when hovering over the slide

    arrows: false, // Disable Splide's default arrows

  });

  // Custom arrows from Webflow

  const prevArrow = document.querySelector(

    '.splide_prev'); // Replace with your Webflow class for the previous arrow

  const nextArrow = document.querySelector(

    '.splide_next'); // Replace with your Webflow class for the next arrow

  // Add event listeners to custom arrows

  if (prevArrow && nextArrow) {

    prevArrow.addEventListener('click', () => {

      slider.go('<'); // Navigate to the previous slide

    });

    nextArrow.addEventListener('click', () => {

      slider.go('>'); // Navigate to the next slide

    });

  }

  // Mount the slider

  slider.mount();
}

