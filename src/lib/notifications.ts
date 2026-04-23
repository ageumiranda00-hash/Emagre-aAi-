
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("Este navegador não suporta notificações desktop");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

export const showNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/favicon.ico", // Fallback icon
      ...options,
    });
  }
};

export const checkGoalsAndNotify = (profile: any, meals: any[], workouts: any[]) => {
  if (!profile.notificationSettings?.enabled) return;

  const today = new Date().setHours(0, 0, 0, 0);
  const todayMeals = meals.filter(m => {
    const d = m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp);
    return d.setHours(0, 0, 0, 0) === today;
  });

  const consumedCalories = todayMeals.reduce((acc, m) => acc + (m.calories || 0), 0);
  const consumedProtein = todayMeals.reduce((acc, m) => acc + (m.protein || 0), 0);
  
  // Example: Notify if calories are close to limit or if protein is low late in the day
  const now = new Date();
  const hour = now.getHours();

  if (profile.notificationSettings.goalReminders) {
    if (hour >= 20 && consumedProtein < (profile.targetProtein * 0.8)) {
      showNotification("Meta de Proteína", {
        body: `Você ainda precisa de ${(profile.targetProtein - consumedProtein).toFixed(0)}g de proteína hoje!`,
      });
    }

    if (consumedCalories > profile.targetCalories) {
      showNotification("Meta de Calorias Excedida", {
        body: `Você ultrapassou sua meta diária em ${(consumedCalories - profile.targetCalories).toFixed(0)} kcal.`,
      });
    }
  }

  // Water reminders (simplified logic for demo)
  if (profile.notificationSettings.waterReminders && hour >= 9 && hour <= 21) {
    // In a real app, we'd track water logs. For now, just a periodic reminder.
    const lastReminder = localStorage.getItem('last_water_reminder');
    const lastTime = lastReminder ? parseInt(lastReminder) : 0;
    
    if (Date.now() - lastTime > 1000 * 60 * 60 * 2) { // Every 2 hours
      showNotification("Hora de beber água!", {
        body: "Mantenha-se hidratado para otimizar seu metabolismo.",
      });
      localStorage.setItem('last_water_reminder', Date.now().toString());
    }
  }

  // Guide reminders (recommendations)
  if (profile.notificationSettings.guideReminders && hour === 10) { // Morning tip
    const lastGuideReminder = localStorage.getItem('last_guide_reminder');
    const lastTime = lastGuideReminder ? parseInt(lastGuideReminder) : 0;
    const todayStr = new Date().toDateString();
    
    if (new Date(lastTime).toDateString() !== todayStr) {
      showNotification("Dica do Guia de Emagrecimento", {
        body: "Confira as recomendações de hoje no seu guia exclusivo para acelerar seus resultados!",
      });
      localStorage.setItem('last_guide_reminder', Date.now().toString());
    }
  }
};
