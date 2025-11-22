const displayStatus = () => {

  // Define opening and closing times

  const openingHour = 11; // 11:00 AM

  const closingHour = 22; // 10:00 PM

  const now = new Date();

  const currentHour = now.getHours();

  const currentMinutes = now.getMinutes();

  // Days of operation: Wednesday to Sunday

  const operatingDays = [3, 4, 5, 6, 0]; // 0 = Sunday, 1 = Monday, etc.

  // Check if today is an operating day

  if (!operatingDays.includes(now.getDay())) {

    document.getElementById("status").innerText = "Wir haben derzeit geschlossen.";

    return;

  }

  // Check if within operating hours

  if (currentHour >= openingHour && currentHour < closingHour) {

    // Calculate if closing soon (within 2 hours)

    if (currentHour >= closingHour - 2) {

      const minutesLeft = ((closingHour - 1) * 60 + 60) - (currentHour * 60 + currentMinutes);

      document.getElementById("status").innerText =

        `Wir schließen bald! Noch geöffnet für ${Math.ceil(minutesLeft / 60)} Stunde(n).`;

    } else {

      document.getElementById("status").innerText = "Wir haben derzeit geöffnet.";

    }

  } else {

    document.getElementById("status").innerText = "Wir haben derzeit geschlossen.";

  }

};

// Execute the displayStatus function

displayStatus();

