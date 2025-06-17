let currentIndex = index;
const items = document.querySelectorAll(".carousel-item");

function showSlide(index) {
  items.forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });
}

function nextSlide() {
  currentIndex = (currentIndex + 1) % items.length;
  showSlide(currentIndex);
}

function prevSlide() {
  currentIndex = (currentIndex - 1 + items.length) % items.length;
  showSlide(currentIndex);
}

function closeCarousel() {
  window.location.href = "/";
}



document.addEventListener("DOMContentLoaded", () => showSlide(currentIndex));
