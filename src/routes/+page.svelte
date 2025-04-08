<script>
  let lastSavedText = "";
  let showSaveIndicator = false; // Initialize the indicator visibility state
  // Replace $app/environment import with direct browser detection
  const browser = typeof window !== 'undefined';
  import { onMount, tick } from 'svelte';
  // Import writable from svelte/store
  import { writable } from 'svelte/store';

  // --- Debounce Utility ---
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  // --- End Debounce Utility ---

  // --- LocalStorage Store Helper ---
  // Creates a Svelte store that automatically saves its value to localStorage
  // and loads the saved value on initialization.
  function localStorageStore(key, initialValue) {
    let storedValue = null;
    // Check if localStorage is available AND we are in the browser
    if (browser && typeof localStorage !== 'undefined') {
      try {
        storedValue = localStorage.getItem(key);
      } catch (e) {
        console.error(`Error reading localStorage key "${key}":`, e);
        storedValue = null;
      }
    }

    let value = initialValue;
    if (storedValue !== null) {
      try {
        const parsed = JSON.parse(storedValue);
        // --- Validation for Array Structure ---
        // Check if it's an array and each item has title (string) and content (string)
        if (
          Array.isArray(parsed) &&
          parsed.every(item => typeof item === 'object' && item !== null &&
                                typeof item.title === 'string' &&
                                typeof item.content === 'string')
        ) {
          value = parsed;
        } else {
          console.warn(`Invalid data format found in localStorage for key "${key}". Expected array of {title: string, content: string}. Resetting to initial value.`);
          // Keep initialValue if validation fails
        }
        // --- End Validation ---
      } catch (e) {
        console.error(`Failed to parse localStorage key "${key}":`, e);
        // If parsing fails, fall back to initial value
      }
    }

    // ---> RE-ADD LOGGING <---
    if (browser) {
      console.log('Initializing store with value:', JSON.stringify(value)); 
    }
    // ---> END LOGGING <---

    const store = writable(value);

    // --- Debounced Save Function ---
    const saveToLocalStorage = debounce((currentValue) => {
       if (browser && typeof localStorage !== 'undefined') {
          try {
             // ---> RE-ADD LOGGING <---
             console.log('[Save]: Saving to localStorage:', JSON.stringify(currentValue)); 
             localStorage.setItem(key, JSON.stringify(currentValue));
             console.log('[Save]: Notes potentially saved.'); // Log success
             
             // Show save indicator
             lastSavedText = new Date().toLocaleTimeString();
             showSaveIndicator = true;
             setTimeout(() => {
               showSaveIndicator = false;
             }, 2000); // Hide after 2 seconds
          } catch (e) {
             console.error(`Error writing to localStorage key "${key}":`, e);
          }
       }
    }, 750); // Debounce save by 750ms (adjust as needed)
    // --- End Debounced Save Function ---

    // Only subscribe if in the browser
    if (browser) {
       store.subscribe((currentValue) => {
          saveToLocalStorage(currentValue); // Call the debounced save function
       });
    }

    return store;
  }
  // --- End LocalStorage Store Helper ---

  // Define theme colors (using hex codes for easier manipulation)
  const themeColors = [
    '#ef4444', // Red-500 (Initial)
    '#3b82f6', // Blue-500
    '#22c55e', // Green-500
    '#eab308', // Yellow-500
    '#8b5cf6', // Violet-500
    '#ec4899', // Pink-500
    '#f97316', // Orange-500
  ];

  // --- Date Helpers ---
  function getCurrentQuarter() {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    return Math.floor(month / 3) + 1; // Returns 1, 2, 3, or 4
  }

  function getQuarterString(quarter, year) {
    return `Q${quarter}`;
  }

  function getEndOfQuarter(year, quarter) {
    const endMonth = quarter * 3; // March=3, June=6, Sept=9, Dec=12
    // Create date for the *first* day of the *next* quarter, then go back 1ms
    return new Date(year, endMonth, 1, 0, 0, 0, 0) - 1; 
  }

  function getEndOfWeek() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ... 6=Saturday
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek; // Days until coming Sunday (0 if today is Sunday)
    const endOfWeek = new Date(now);
    // Set date to next Sunday, time to midnight
    endOfWeek.setDate(now.getDate() + daysUntilSunday); 
    endOfWeek.setHours(24, 0, 0, 0); // Midnight at the *end* of Sunday
    return endOfWeek;
  }

  function getEndOfDay() {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(24, 0, 0, 0); // Midnight at the *end* of today
    return endOfDay;
  }

   function formatTimeDifferenceDays(diffMillis) {
    const days = Math.max(0, Math.ceil(diffMillis / (1000 * 60 * 60 * 24))); // Round up days
    return `${days}d`;
  }

  function formatTimeDifferenceMinutes(diffMillis) {
    const minutes = Math.max(0, Math.floor(diffMillis / (1000 * 60)));
     return `${minutes}m`;
  }

  // New function for H:M:S format
  function formatTimeDifferenceHMS(diffMillis) {
    if (diffMillis <= 0) return `0s`; // Handle expired case

    const totalSeconds = Math.max(0, Math.floor(diffMillis / 1000));
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`); // Show minutes if hours>0 or minutes>0
    parts.push(`${seconds}s`); // Always show seconds

    return parts.join(' ');
  }
  // --- End Date Helpers ---

  // Get current year and quarter
  const currentYear = new Date().getFullYear();
  const currentQuarterNumber = getCurrentQuarter();
  const currentQuarterKey = getQuarterString(currentQuarterNumber, currentYear);

  // --- Initialize Notes Store (Array Structure) ---
  const initialNotesState = [
    { title: currentQuarterKey, content: '' }, // Dynamic quarter title
    { title: 'This week', content: '' },
    { title: 'Today', content: '' }
  ];

  // Create the notes store using the localStorage helper
  // Key: 'notesArrayData', Initial State: initialNotesState
  const notes = localStorageStore('notesArrayData', initialNotesState);
  // --- End Initialize Notes Store ---

  // Removed: let noteContent = ''; (replaced by notes object)
  // Removed: let editorElement; (will use event.target)
  let isTyping = false;
  let typingTimer;

  // Reactive variable for the current theme color
  let currentThemeColor = themeColors[0]; 

  // Reactive variables for countdowns
  let quarterCountdown = '';
  let weekCountdown = '';
  let dayCountdown = ''; 

  // Function to convert hex to rgba
  function hexToRgba(hex, alpha = 0.2) { // Default alpha 20%
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) { // Expand shorthand hex
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex[1] + hex[2], 16);
      g = parseInt(hex[3] + hex[4], 16);
      b = parseInt(hex[5] + hex[6], 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Function to update the ::selection style globally
  let selectionStyleElement = null;
  function updateSelectionStyle(color) {
    if (!browser) return; // Only run in browser
    
    const rgbaColor = hexToRgba(color, 0.3); // Use 30% opacity for selection
    if (!selectionStyleElement) {
      selectionStyleElement = document.createElement('style');
      document.head.appendChild(selectionStyleElement);
    }
    // Use !important to override potential conflicts
    selectionStyleElement.textContent = `
      ::selection { background-color: ${rgbaColor} !important; }
      ::-moz-selection { background-color: ${rgbaColor} !important; } 
    `;
  }

  // Function to handle typing state
  function handleTypingState() {
    isTyping = true;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
    }, 500);
  }

  // Function to handle clicks within any editor (for checkbox color change)
  function handleEditorClick(event) {
    if (event.target.matches('.todo-checkbox')) {
      // Find a new color different from the current one
      let newColor;
      do {
        newColor = themeColors[Math.floor(Math.random() * themeColors.length)];
      } while (newColor === currentThemeColor && themeColors.length > 1);
      
      currentThemeColor = newColor; // Update the reactive variable
      updateSelectionStyle(currentThemeColor); // Update selection style
    }
  }

  // Function to handle input and check for [] pattern - MODIFIED for Array Store
  async function handleInput(event) {
    // Ensure input is coming from one of our editor divs
    if (!event.target.matches('.editor-area')) return;

    handleTypingState();

    const title = event.target.dataset.title;
    const editorDiv = event.target; // Keep reference to the editor
    let contentChangedByCheckbox = false; // Flag

    // --- Try Checkbox Logic First ---
    await tick(); // Allow DOM to potentially update
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const textBeforeCursor = text.slice(0, offset);

        // Check for '[] ' pattern
        if (textBeforeCursor.endsWith('[] ') && (textBeforeCursor.length === 3 || node?.previousSibling?.nodeName === 'BR' || node?.parentNode === editorDiv)) {
          const textBeforePattern = textBeforeCursor.slice(0, -3);
          const textAfterCursor = text.slice(offset);

          try {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'todo-checkbox mr-1 align-middle'; // Added styling

            const beforeNode = document.createTextNode(textBeforePattern);
            const afterNode = document.createTextNode('\u00A0' + textAfterCursor); // Add non-breaking space

            const parent = node.parentNode;
            if (parent && node && parent === editorDiv) { 
                parent.replaceChild(afterNode, node);
                parent.insertBefore(checkbox, afterNode);
                parent.insertBefore(beforeNode, checkbox);

                // --- Update Store Immediately After Checkbox DOM Change ---
                const updatedHtmlAfterCheckbox = editorDiv.innerHTML;
                notes.update(currentNotes =>
                  currentNotes.map(note =>
                    note.title === title ? { ...note, content: updatedHtmlAfterCheckbox } : note
                  )
                );
                console.log('[Checkbox]: Updated store after checkbox insert.');
                contentChangedByCheckbox = true;
                // --- End Store Update ---

                // --- Restore Cursor Position ---
                await tick(); 
                range.setStart(afterNode, 1); 
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                // --- End Cursor Restore ---
            }
          } catch (error) {
            console.error('[Checkbox Error]: Failed during DOM manipulation or cursor setting:', error);
            // Optionally try to recover or just prevent crash
          }
        }
      }
    }
    // --- End Checkbox Logic ---

    // --- Standard Update (if checkbox didn't change content) ---
    if (!contentChangedByCheckbox) {
        const newContent = editorDiv.innerHTML; // Get potentially changed content

        // Check if content actually changed before updating store
        let currentContent = '';
        const unsubscribe = notes.subscribe(currentNotes => {
            const note = currentNotes.find(n => n.title === title);
            currentContent = note ? note.content : '';
        });
        unsubscribe(); // Immediately unsubscribe

        if (newContent !== currentContent) {
            // console.log('handleInput: Standard update needed.')
            notes.update(currentNotes => {
                // console.log('[Update]: Store update starting. Input Notes:', JSON.stringify(currentNotes));
                const updatedNotes = currentNotes.map(note => {
                if (note.title === title) {
                    // console.log(`[Update]: Mapping: Found target note "${title}", updating content.`);
                    return { ...note, content: newContent };
                } else {
                    return note;
                }
                });
                // console.log('[Update]: Store update finished. Output Notes:', JSON.stringify(updatedNotes));
                return updatedNotes;
            });
        }
    }
    // --- End Standard Update ---
  }
  // --- End handleInput ---

  // Function to handle keydown and check for [] pattern - MODIFIED for Array Store
  function handleKeydown(event) {
    // Ensure input is coming from one of our editor divs
    if (!event.target.matches('.editor-area')) return;

    handleTypingState();
  }

  // No need for add/delete functions for a single note
  // function addNote() { ... }
  // function deleteNote() { ... }
  
  onMount(() => {
    if (!browser) return; // Guard against server-side execution
    
    updateSelectionStyle(currentThemeColor); 

    // --- Initial Countdown Calculation ---
    function updateCountdowns() {
        const now = new Date().getTime(); // Current time in milliseconds

        // Quarter
        const endOfQuarterMillis = getEndOfQuarter(currentYear, currentQuarterNumber);
        quarterCountdown = formatTimeDifferenceDays(endOfQuarterMillis - now);

        // Week
        const endOfWeekMillis = getEndOfWeek().getTime();
        weekCountdown = formatTimeDifferenceDays(endOfWeekMillis - now);

        // Day - Use new HMS formatter
        const endOfDayMillis = getEndOfDay().getTime();
        dayCountdown = formatTimeDifferenceHMS(endOfDayMillis - now); // Use HMS format
    }

    updateCountdowns(); // Initial call
    // Interval to update countdowns frequently - Changed to 1 second
    const countdownUpdateInterval = setInterval(updateCountdowns, 1000); // Update every second


    // --- Quarter Change Check (Modified for Array Store) ---
    const quarterCheckInterval = setInterval(() => {
      const now = new Date();
      const newQuarterNumber = getCurrentQuarter();
      const newYear = now.getFullYear();
      const newQuarterKey = getQuarterString(newQuarterNumber, newYear); // e.g., "Q4"

      // Use $notes to read the current store value
      const currentNotesValue = $notes;
      // Find the index of the note that likely holds the old quarter data
      // We assume it's the first one based on initialNotesState structure
      // More robustly check if the title starts with 'Q' followed by a digit.
      const quarterNoteIndex = currentNotesValue.findIndex(note => /^Q\d$/.test(note.title));


      if (quarterNoteIndex !== -1) {
          const oldQuarterTitle = currentNotesValue[quarterNoteIndex].title;

          if (newQuarterKey !== oldQuarterTitle) {
              console.log(`Quarter changed! Old: ${oldQuarterTitle}, New: ${newQuarterKey}`);
              // Update the store: find the note by old title and change its title property
              notes.update(currentNotes =>
                  currentNotes.map(note =>
                      note.title === oldQuarterTitle ? { ...note, title: newQuarterKey } : note
                  )
              );
              // Recalculate countdowns as the quarter key (used for display) has changed
              // Also update the global currentQuarterKey variable used for comparisons
              // currentQuarterKey = newQuarterKey; // This line might cause issues if currentQuarterKey is needed elsewhere unchanged until next mount. Let's rely on the title comparison in the loop.
              updateCountdowns();
          }
      } else {
          console.warn("Could not find the Quarter note object in the store to check for updates.");
          // If the Quarter note is missing, we could potentially add it back here.
          // For now, just log a warning.
          // Example: notes.update(n => [{ title: newQuarterKey, content: '' }, ...n.filter(note => !/^Q\d$/.test(note.title))]);
      }
    }, 3600 * 1000); // Check every hour
    // --- End Quarter Change Check ---

    // --- Set Initial Editor Content --- 
    // Add a short delay to ensure the editors are in the DOM
    setTimeout(() => {
      console.log('onMount: Setting initial editor content...');
      $notes.forEach(note => {
        const editorDiv = document.querySelector(`.editor-area[data-title="${note.title}"]`);
        if (editorDiv) {
          console.log(`Found editor for "${note.title}". Setting content.`);
          // Only set if different to avoid potential cursor jumps/issues
          if (editorDiv.innerHTML !== note.content) { 
             editorDiv.innerHTML = note.content;
             console.log(`[onMount]: Set innerHTML for "${note.title}".`);
          }
        } else {
          console.warn(`onMount: Could not find editor div for note titled "${note.title}"`);
        }
      });
    }, 0);
    // --- End Set Initial Editor Content ---

    // Cleanup timer and intervals on unmount
    return () => {
      clearTimeout(typingTimer);
      clearInterval(quarterCheckInterval); 
      clearInterval(countdownUpdateInterval); // Clear the countdown interval
      if (selectionStyleElement && selectionStyleElement.parentNode) {
        selectionStyleElement.parentNode.removeChild(selectionStyleElement);
      }
    };
  });
</script>

<!-- Main container -->
<!-- Use $notes to access the store's value in the template -->
<main
  class="flex flex-col items-center justify-start min-h-screen w-full py-16 space-y-12"
  style="--theme-color: {currentThemeColor};"
  on:input={handleInput}
  on:click={handleEditorClick}
  on:keydown={handleKeydown}
>
  <!-- Iterate over the notes array from the store -->
  <!-- Use note.title as the key for {#each} for proper reactivity -->
  {#each $notes as note (note.title)}
    <!-- Section: Added px-4 -->
    <section class="w-full max-w-2xl px-4">
      <!-- Section Title Row: Use items-center for vertical alignment -->
      <h2 class="text-xl font-semibold text-gray-500 mb-3 flex items-center space-x-2">
        <!-- Display note.title -->
        <span>{note.title}</span> <!-- Wrap key in span for spacing -->
        <!-- Countdown Pill Logic based on note.title -->
        {#if /^Q\d$/.test(note.title)} <!-- Check if title matches Quarter format (e.g., Q1, Q2) -->
          <span class="countdown-pill">
              {quarterCountdown}
          </span>
        {:else if note.title === 'This week'}
            <span class="countdown-pill">
              {weekCountdown}
          </span>
        {:else if note.title === 'Today'}
           <span class="countdown-pill today-countdown">
              {dayCountdown}
          </span>
        {/if}
      </h2>

      <!-- ContentEditable Editor Area -->
      <!-- The contenteditable div below displays the note content -->
      <!-- It uses note.content for initial display and note.title to identify which note to update -->
      <div
        contenteditable="true"
        data-title={note.title}
        class="flex-grow focus:outline-none text-gray-800 editor-area"
        class:typing={isTyping}
        placeholder="Start writing or type [] for a to-do..."
      >{@html note.content}</div>
    </section>
  {/each}
  <div
    class="absolute bottom-4 right-4 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full shadow-sm transition-opacity duration-300 text-right"
    class:opacity-0={!showSaveIndicator}
    class:opacity-100={showSaveIndicator}
  >
    Saved {lastSavedText}
  </div>
</main>

<style>
  /* REMOVE or COMMENT OUT the static Red selection highlight */
  /* :global(*::selection) {
    @apply bg-red-500/20; 
  } */

  /* Style the contenteditable div like a textarea */
  .editor-area {
    font-size: 1.1rem;
    white-space: pre-wrap; /* Preserve whitespace and wrap lines */
    word-wrap: break-word; /* Break long words */
    min-height: 80px; /* Slightly smaller min-height per section */
    /* Use CSS variable for caret color */
    caret-color: var(--theme-color);
    /* caret-width: thick; */ /* Thicker cursor - removed as blink animation handles caret visibility */
    border: 1px dashed transparent; /* Add transparent border for layout stability */
  }

  .editor-area:not(.typing) {
    animation: blink 0.75s step-end infinite;
    -webkit-animation: blink 0.75s step-end infinite;
  }

  /* Placeholder styling for contenteditable div */
  [contenteditable][placeholder]:empty:before {
    content: attr(placeholder);
    color: #a0aec0; /* gray-500 */
    cursor: text;
    /* Ensure placeholder doesn't prevent clicking */
    pointer-events: none;
    display: block; /* Needed for placeholder */
  }

  @keyframes blink {
    0%, 100% { caret-color: transparent; }
    50% { caret-color: var(--theme-color); }
  }

  @-webkit-keyframes blink {
    0%, 100% { caret-color: transparent; }
    50% { caret-color: var(--theme-color); }
  }

  /* Countdown Pill Styles */
  .countdown-pill {
    @apply text-xs font-medium px-2 py-0.5 rounded-full inline-block; /* Ensure inline-block */
    background-color: #f3f4f6; /* gray-100 */
    color: #9ca3af; /* Lighter gray-400 */
    white-space: nowrap; /* Prevent wrapping */
    transition: color 0.3s ease, background-color 0.3s ease; /* Smooth transitions */
  }

  /* Specific class for the Today countdown animation & fixed width */
  .today-countdown {
      animation: pulse 2s infinite ease-in-out;
      width: 8em; /* Increased fixed width - adjust as needed */
      text-align: center; /* Center text within the fixed width */
      /* Override horizontal padding from base class */
      padding-left: 0.5rem; /* Equivalent to px-1 */
      padding-right: 0.5rem; /* Equivalent to px-1 */
  }


  /* Subtle Pulse animation for Today countdown */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  /* Custom styles for the To-Do Checkbox using CSS variable */
  /* Use :global() to apply styles inside contenteditable */
  :global(.todo-checkbox) {
    appearance: none;
    -webkit-appearance: none;
    background-color: transparent;

    @apply w-4 h-4;
    /* Use CSS variable for border color */
    border: 2px solid var(--theme-color);
    @apply rounded mr-1.5 cursor-pointer inline-block;

    vertical-align: text-bottom; /* Align better with text */
    /* Adjust position slightly if needed */
    transform: translateY(-1px);
  }

  /* Style for the checked state using CSS variable */
  :global(.todo-checkbox:checked) {
    /* Use CSS variable for background and border */
    background-color: var(--theme-color); 
    border-color: var(--theme-color); 
    
    /* Checkmark SVG remains white - ensure chosen colors contrast well */
    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
    background-size: 100% 100%;
    background-position: center;
    background-repeat: no-repeat;
  }
</style> 