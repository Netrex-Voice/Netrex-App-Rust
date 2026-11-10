
// Utility to manage graceful cleanup during app exit
// Ensures all async tasks (Firebase updates, etc) complete before Electron quits

if (typeof window !== 'undefined') {
  window._netrexCleanupTasks = new Set();
}

/**
 * Registers a cleanup task to be run when the application is quitting.
 * @param {Function} task - An async function that performs cleanup
 * @returns {Function} - A disposer function to unregister the task (e.g. on component unmount)
 */
export function registerCleanupTask(task) {
  if (typeof window === 'undefined') return () => {};
  
  window._netrexCleanupTasks.add(task);
  
  return () => {
    window._netrexCleanupTasks.delete(task);
  };
}

/**
 * Executes all registered cleanup tasks and then notifies the main process.
 * Should be called by the top-level app-will-quit listener.
 */
export async function executeCleanupTasks() {
  if (typeof window === 'undefined') return;

  const tasks = Array.from(window._netrexCleanupTasks);
  if (tasks.length > 0) {
    console.log(`🧹 Running ${tasks.length} cleanup tasks...`);
    // Run all tasks in parallel and wait for them
    await Promise.allSettled(tasks.map(t => {
      try {
        return t();
      } catch (e) {
        console.error("Cleanup task failed:", e);
        return Promise.resolve();
      }
    }));
    console.log("✅ All cleanup tasks completed.");
  }

  // Notify main process that we are done
  if (window.netrex?.notifyCleanupComplete) {
    window.netrex.notifyCleanupComplete();
  }
}
