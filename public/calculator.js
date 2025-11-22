// Selectors for various elements in the pricing calculator

const guestInput = document.querySelector('#number-of-guests');

const beveragePackages = document.querySelectorAll('[data-type="beverages"]');

const foodPackages = document.querySelectorAll('[data-type="food"]');

const extrasPackages = document.querySelectorAll('[data-type="extras"]');

const empfangsPauschale = document.querySelectorAll('[name="Empfangspauschale"]');

const appetizerContainers = document.querySelectorAll('[data-price-group]');

const totalPriceDisplay = document.querySelector('[data-text="total"]');

const comboItems = document.querySelectorAll('[data-group="combo"]');

const minGuestItems = document.querySelectorAll('[min-guests]');



// Function to calculate the total price based on selections

function calculateTotal() {

  let total = 0;

  const basePricePerGuest = 50;

  const numberOfGuests = parseInt(guestInput.value) || 10;



  // Check if the trigger radio button is active

  const triggerActive = document.querySelector("[radio-group='trigger-1']:checked") !== null;



  minGuestItems.forEach(item => {

    const minGuests = parseInt(item.getAttribute('min-guests')) || 0;

    if (numberOfGuests >= minGuests) {

      item.classList.remove('inactive');

    } else {

      item.classList.add('inactive');

      const groupName = item.querySelector('input[type="radio"]').name;

      const resetToggle = document.querySelector(`[toggle-reset][name="${groupName}"]`);

      const itemToggle = item.querySelector('input[type="radio"]');

      if (itemToggle && itemToggle.checked) {

        if (resetToggle) {

          resetToggle.click();

        } else {

          itemToggle.click();

        }

      }

    }

  });



  beveragePackages.forEach(pkg => {

    if (pkg.checked) total += parseFloat(pkg.getAttribute('data-price')) * numberOfGuests;

  });

  foodPackages.forEach(pkg => {

    if (pkg.checked) total += parseFloat(pkg.getAttribute('data-price')) * numberOfGuests;

  });

  extrasPackages.forEach(pkg => {

    if (pkg.checked) total += parseFloat(pkg.getAttribute('data-price')) * numberOfGuests;

  });

  empfangsPauschale.forEach(pkg => {

    if (pkg.checked) total += parseFloat(pkg.getAttribute('data-price')) * numberOfGuests;

  });




  // Include or exclude values from target group based on trigger's status

  if (triggerActive) {

    document.querySelectorAll("[radio-group='target-1']").forEach(target => {

      if (target.checked) {

        total += parseFloat(target.value) || 0;

      }

    });

  }



  appetizerContainers.forEach(container => {

    const pricePerItem = parseFloat(container.getAttribute('data-price-group'));

    const inputs = container.querySelectorAll('input[type="number"][data-type="starter"]');

    inputs.forEach(input => {

      const checkbox = input.closest('.price_check-option').querySelector(

        'input[type="checkbox"]');

      const qtyInput = input.closest('.price_check-option').querySelector(

        '.form_field.is-qty');

      if (checkbox.checked) {

        qtyInput.classList.add('is-active');

        let quantity = parseInt(input.value) || 0;

        quantity = Math.max(quantity, 20);

        total += quantity * pricePerItem;

      } else {

        qtyInput.classList.remove('is-active');

      }

    });

  });



  comboItems.forEach(item => {

    const checkbox = item.querySelector('input[type="checkbox"]');

    const quantityInput = item.querySelector('.form_field.is-qty');

    if (checkbox.checked) {

      const quantity = parseInt(quantityInput.value) || 1;

      const pricePerItem = parseFloat(checkbox.getAttribute('data-price'));

      total += quantity * pricePerItem;

      quantityInput.classList.add('is-active');

    } else {

      quantityInput.classList.remove('is-active');

    }

  });



  if (totalPriceDisplay) {
    totalPriceDisplay.textContent = total.toFixed(2);
  }

}



// Add event listeners for the trigger and target group elements

document.querySelectorAll("[radio-group='trigger-1']").forEach(trigger => {

  trigger.addEventListener('change', calculateTotal);

});

document.querySelectorAll("[radio-group='target-1']").forEach(target => {

  target.addEventListener('change', calculateTotal);

});



// Trigger clicks on elements that should simulate a click on page load

const targetElements = document.querySelectorAll('[target-click]');

targetElements.forEach(element => {

  element.click();

});



// Attach event listeners to various inputs to update total price on changes
// Only attach listeners if elements exist (calculator might not be on all pages)

if (guestInput) {
  guestInput.addEventListener('input', calculateTotal);
}

beveragePackages.forEach(pkg => pkg.addEventListener('change', calculateTotal));

foodPackages.forEach(pkg => pkg.addEventListener('change', calculateTotal));

extrasPackages.forEach(pkg => pkg.addEventListener('change', calculateTotal));

empfangsPauschale.forEach(pkg => pkg.addEventListener('change', calculateTotal));

document.querySelectorAll('[data-type="starter"]').forEach(input => {

  const checkbox = input.closest('.price_check-option').querySelector('input[type="checkbox"]');

  checkbox.addEventListener('change', calculateTotal);

});

document.querySelectorAll('input[type="number"][data-type="starter"]').forEach(input => {

  input.addEventListener('input', calculateTotal);

});



// Perform initial calculation to display default total price

calculateTotal();



// SUMMARY

const summaryContent = document.getElementById("summary-content");

// Exit early if summary section doesn't exist
if (!summaryContent) {
  console.log('[Calculator] Summary section not found, skipping summary functionality');
}

// Create a new group or find an existing one in the summary section

function getGroupElement(group) {
  if (!summaryContent) return null;

  let groupElement = summaryContent.querySelector(`.summary_group[data-group="${group}"]`);

  if (!groupElement) {

    groupElement = document.createElement("div");

    groupElement.classList.add("summary_group");

    groupElement.setAttribute("data-group", group);

    const groupNameElement = document.createElement("div");

    groupNameElement.classList.add("summary_group-name");

    groupNameElement.textContent = group;

    groupElement.appendChild(groupNameElement);

    const itemListElement = document.createElement("ul");

    itemListElement.classList.add("summary_item-list");

    groupElement.appendChild(itemListElement);

    summaryContent.appendChild(groupElement);

  }

  return groupElement.querySelector(".summary_item-list");

}



// Add or update items in the summary section based on selections

function addItemToGroup(group, name, price) {
  if (!summaryContent) return;

  const groupElement = getGroupElement(group);
  if (!groupElement) return;

  let itemElement = groupElement.querySelector(`[data-item="${name}"]`);

  if (!itemElement) {

    itemElement = document.createElement("li");

    itemElement.setAttribute("data-item", name);

    const itemNameElement = document.createElement("span");

    itemNameElement.classList.add("summary_item");

    itemNameElement.textContent = name;

    itemElement.appendChild(itemNameElement);

    const itemPriceElement = document.createElement("span");

    itemPriceElement.classList.add("summary_price");

    itemPriceElement.textContent = `: ${price}`;

    itemElement.appendChild(itemPriceElement);

    groupElement.appendChild(itemElement);

  } else {

    itemElement.querySelector(".summary_price").textContent = `: ${price}`;

  }

  updateSummaryTotalPrice(); // Update the total price displayed in the summary

}



// Remove an item from the summary section

function removeItemFromGroup(group, name) {
  if (!summaryContent) return;

  const groupElement = getGroupElement(group);
  if (!groupElement) return;

  const itemElement = groupElement.querySelector(`[data-item="${name}"]`);

  if (itemElement) {

    groupElement.removeChild(itemElement);

    if (!groupElement.querySelector("li")) {

      const groupToRemove = summaryContent.querySelector(`.summary_group[data-group="${group}"]`);

      if (groupToRemove) {

        summaryContent.removeChild(groupToRemove);

      }

    }

  }

  updateSummaryTotalPrice(); // Update total after removing an item

}



// Update the display of total price in the summary

function updateSummaryTotalPrice() {
  if (!summaryContent) return;

  const totalPriceElement = document.querySelector('[data-text="total"]');

  const totalValue = totalPriceElement ? totalPriceElement.textContent : "0.00";



  let summaryTotalElement = summaryContent.querySelector(".summary_total-price");

  if (!summaryTotalElement) {

    summaryTotalElement = document.createElement("div");

    summaryTotalElement.classList.add("summary_total-price");

    summaryContent.appendChild(summaryTotalElement);

  } else {

    // Remove it to ensure it stays at the end

    summaryContent.removeChild(summaryTotalElement);

  }

  summaryTotalElement.textContent = `Gesamtpreis: ${totalValue}`;

  summaryContent.appendChild(summaryTotalElement); // Re-append as the last child



  // Update the input field with id "angebot"

  updateAngebot();

}



// NEW FUNCTION: Copy summary content into the input field with id "angebot"

function updateAngebot() {

  const angebotInput = document.querySelector('#angebot');

  if (angebotInput) {

    angebotInput.value = summaryContent.innerText;

  }

}



// Function to update the summary when the guest count changes

function updateSummary() {

  const guestsInput = document.querySelector("#number-of-guests");

  if (guestsInput) {

    const group = "Gäste";

    const itemName = "Anzahl der Gäste";

    const price = parseInt(guestsInput.value) || 10;

    addItemToGroup(group, itemName, price);

  }

}



// Function to initialize all groups and pre-selected items

function initializeSummary() {

  document.querySelectorAll("[summary-group]").forEach((element) => {

    const group = element.getAttribute("summary-group");



    // Ensure the group element is found before proceeding

    const groupElement = getGroupElement(group);

    if (groupElement) {

      element.querySelectorAll("input[target-click]").forEach((input) => {

        const label = input.closest("label");

        if (label) {

          const nameElement = label.querySelector("[summary-item='name']");

          const priceElement = label.querySelector("[summary-item='price']");



          // Check if both nameElement and priceElement exist

          if (nameElement && priceElement) {

            const name = nameElement.textContent;

            const price = priceElement.textContent;

            if (input.checked) {

              addItemToGroup(group, name, price);

            }

          }

        }

      });

    }

  });



  updateSummary(); // Initially update the guest count

  updateSummaryTotalPrice(); // Update total price after initialization

}



// Add event listeners for dynamic updates based on input changes

document.querySelectorAll("[summary-group]").forEach((element) => {

  const group = element.getAttribute("summary-group");

  element.querySelectorAll("input[type='checkbox'], input[type='radio']").forEach((input) => {

    input.addEventListener("change", function () {

      const name = this.closest("label").querySelector("[summary-item='name']")

        .textContent;

      const price = this.closest("label").querySelector("[summary-item='price']")

        .textContent;

      if (this.checked) {

        if (this.type === "radio") {

          const groupElement = getGroupElement(group);

          groupElement.innerHTML = ""; // Clear the group if the input type is radio

        }

        addItemToGroup(group, name, price);

      } else if (this.type === "checkbox") {

        removeItemFromGroup(group, name);

      }

    });

  });

});



// Event listener for dynamically updating the guest count

guestInput.addEventListener('input', () => {

  updateSummary(); // Update the summary details based on new guest count

  updateSummaryTotalPrice(); // Refresh the total price in the summary

});



// Initialize the summary on page load

initializeSummary(); // Set up initial summary view with default selections



// PRINT

const printButton = document.querySelector('[print="button"]');

if (printButton) {

  printButton.addEventListener('click', function () {

    window.print();

  });

}

