<script>
  import { onMount, tick } from 'svelte';
  import { writable } from 'svelte/store';

  // Simple browser detection that works without SvelteKit's $app/environment
  const isBrowser = typeof window !== 'undefined';

  // Saved indicator state
  let lastSavedText = "";
  let showSaveIndicator = false;

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
  function localStorageStore(key, initialValue) {
    // Create writable store with initial value
    const store = writable(initialValue);
    
    // Only run in browser environment
    if (isBrowser) {
      try {
        // Try to get stored value
        const storedValue = localStorage.getItem(key);
        
        if (storedValue) {
          try {
            // Parse and validate stored data
            const parsedValue = JSON.parse(storedValue);
            if (Array.isArray(parsedValue) && 
                parsedValue.every(item => typeof item === 'object' && item !== null &&
                                typeof item.title === 'string' &&
                                typeof item.content === 'string')) {
              // If valid, set store to stored value
              store.set(parsedValue);
              console.log(`Loaded data from localStorage: ${key}`, parsedValue);
            } else {
              console.warn(`Invalid data in localStorage: ${key}. Using initial value.`);
            }
          } catch (e) {
            console.error(`Error parsing localStorage data: ${key}`, e);
          }
        } else {
          console.log(`No data found in localStorage: ${key}. Using initial value.`);
        }
        
        // Save to localStorage whenever store changes
        const saveToLocalStorage = debounce((value) => {
          try {
            localStorage.setItem(key, JSON.stringify(value));
            console.log(`Saved to localStorage: ${key}`);
            
            // Show save indicator
            lastSavedText = new Date().toLocaleTimeString();
            showSaveIndicator = true;
            setTimeout(() => {
              showSaveIndicator = false;
            }, 2000);
          } catch (e) {
            console.error(`Error saving to localStorage: ${key}`, e);
          }
        }, 500);
        
        // Set up subscription
        const unsubscribe = store.subscribe(saveToLocalStorage);
        
        // Clean up on page unload
        window.addEventListener('unload', unsubscribe);
      } catch (e) {
        console.error('Error accessing localStorage', e);
      }
    }
    
    return store;
  }

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
  const notes = localStorageStore('notesAppData', initialNotesState);
  // --- End Initialize Notes Store ---

  let isTyping = false;
  let typingTimer;

  // Reactive variable for the current theme color
  let currentThemeColor = themeColors[0]; 

  // Reactive variable for main element styles
  let mainStyle = '';

  // Reactive variables for countdowns
  let focusMessageText = '';
  let showFocusMessage = false;
  let focusMessageTimeout = null;
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
    if (!isBrowser) return; // Only run in browser
    
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

  // Function to handle input and check for [] pattern
  function handleInput(event) {
    if (!event.target.matches('.editor-area')) return;

    handleTypingState();
    const editor = event.target;
    const sectionTitle = editor.dataset.title;
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    let replaced = false; // Flag to check if we replaced []

    // Check if the input likely resulted in "[]" just before the caret
    if (range && range.collapsed) {
        const node = range.startContainer;
        const offset = range.startOffset;

        // Ensure we are in a text node and there's enough text before the caret
        if (node.nodeType === Node.TEXT_NODE && offset >= 2) {
            if (node.textContent.substring(offset - 2, offset) === '[]') {
                // Create the checkbox element
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'todo-checkbox';
                checkbox.contentEditable = 'false'; // Prevent editing the checkbox itself

                // Create a non-breaking space node to go after the checkbox
                const spaceNode = document.createTextNode('\u00A0'); // &nbsp;

                // Create a range covering the "[]" text
                const replaceRange = document.createRange();
                replaceRange.setStart(node, offset - 2); // Start before '['
                replaceRange.setEnd(node, offset);       // End after ']'

                // Delete the "[]" text
                replaceRange.deleteContents();

                // Insert the checkbox and then the space node at the caret position
                // Insert space first, then checkbox before it. This places checkbox then space.
                replaceRange.insertNode(spaceNode);
                replaceRange.insertNode(checkbox);

                // Set the caret position *after* the inserted space node
                // Need to get a new range instance after modification
                const newRange = document.createRange();
                newRange.setStartAfter(spaceNode);
                newRange.collapse(true);
                selection.removeAllRanges(); // Clear previous selection
                selection.addRange(newRange);   // Set the new cursor position

                replaced = true; // Mark that we performed the replacement
                event.preventDefault(); // Prevent potential default actions
            }
        }
    }

    // Update the store *after* DOM manipulation (use timeout for safety)
    // This ensures the store reflects the latest state after our direct change
    // The timeout allows the browser to process the DOM changes before we read innerHTML
    setTimeout(() => {
        const currentContent = editor.innerHTML;
        notes.update(currentNotes =>
            currentNotes.map(note =>
                note.title === sectionTitle ? { ...note, content: currentContent } : note
            )
        );

        // --- Focus Message Logic --- 
        // Count checkboxes in the current section's updated content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentContent;
        const checkboxCount = tempDiv.querySelectorAll('.todo-checkbox').length;

        // Show message if more than one checkbox
        if (checkboxCount > 1) {
            focusMessageText = "focus on one goal that matters";
            showFocusMessage = true;
            // Clear previous hide timeout if it exists
            clearTimeout(focusMessageTimeout);
            // Set new timeout to hide the message
            focusMessageTimeout = setTimeout(() => {
                showFocusMessage = false;
            }, 4000); // Hide after 4 seconds
        }
        // --- End Focus Message Logic ---
    }, 0);
  }
  // --- End handleInput ---

  // --- handleKeydown (handles Enter and Backspace for checkboxes) ---
  function handleKeydown(event) {
    const editor = event.target;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    if (event.key === 'Enter') {
      console.log('Enter key pressed');
      event.preventDefault(); // Prevent default Enter behavior always
      const range = selection.getRangeAt(0);
      const container = range.startContainer;

      let parentElement = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
      console.log('Parent element:', parentElement);

      // Heuristic: Check if the parent element starts with a checkbox
      const startsWithCheckbox = parentElement.firstChild && 
                               parentElement.firstChild.nodeType === Node.ELEMENT_NODE && 
                               parentElement.firstChild.classList.contains('todo-checkbox');
      console.log('startsWithCheckbox:', startsWithCheckbox);

      if (startsWithCheckbox) {
          console.log('Condition met: Inserting new checkbox...');
          // Create elements first
          const br = document.createElement('br');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'todo-checkbox';
          checkbox.contentEditable = 'false';
          const spaceNode = document.createTextNode('\u00A0'); // &nbsp;

          // Insert elements sequentially, adjusting range each time
          range.insertNode(br);
          range.setStartAfter(br);
          range.collapse(true);

          range.insertNode(checkbox);
          range.setStartAfter(checkbox);
          range.collapse(true);

          range.insertNode(spaceNode);

          // Set final cursor position explicitly after the last node
          const finalRange = document.createRange();
          finalRange.setStartAfter(spaceNode);
          finalRange.collapse(true);

          selection.removeAllRanges();
          selection.addRange(finalRange);

          console.log('DOM manipulation complete. Setting store update timeout.');
          // Update store since we modified the DOM directly
          setTimeout(() => {
             const sectionTitle = editor.dataset.title;
             const currentContent = editor.innerHTML;
             notes.update(currentNotes =>
                 currentNotes.map(note =>
                     note.title === sectionTitle ? { ...note, content: currentContent } : note
                 )
             );
         }, 0);
      } else {
          console.log('Condition NOT met: Inserting simple line break...');
          // If line does not start with checkbox, just insert a line break
          const br = document.createElement('br');
          range.insertNode(br);
          range.setStartAfter(br);
          range.collapse(true); // Collapse cursor to after the inserted <br>

          selection.removeAllRanges();
          selection.addRange(range);

          // Update store immediately
          setTimeout(() => {
             const sectionTitle = editor.dataset.title;
             const currentContent = editor.innerHTML;
             notes.update(currentNotes =>
                 currentNotes.map(note =>
                     note.title === sectionTitle ? { ...note, content: currentContent } : note
                 )
             );
         }, 0);
      }
    } else if (event.key === 'Backspace') {
      if (!selection.isCollapsed) {
        handleTypingState(); // Allow default for selection delete
        return; 
      }

      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      const offset = range.startOffset;

      // Check if we are at the very beginning of the editor content
      if ((container === editor || editor.contains(container)) && offset === 0 && !container.previousSibling) {
         // More robust check: check if caret is effectively at pos 0 of editor
         const tempRange = document.createRange();
         tempRange.selectNodeContents(editor);
         tempRange.setEnd(container, offset);
         if (tempRange.toString() === '') {
            handleTypingState(); // At very start, nothing to delete before
            return; 
         }
      }
        
      let nodeBeforeCursor = null;
      try {
         if (offset > 0) {
            // If offset > 0, check the node within the same container at offset - 1
            if (container.nodeType === Node.ELEMENT_NODE) {
                const potentialCheckbox = container.childNodes[offset - 1];
                if (potentialCheckbox && potentialCheckbox.nodeType === Node.ELEMENT_NODE && potentialCheckbox.classList.contains('todo-checkbox')) {
                    nodeBeforeCursor = potentialCheckbox;
                }
            }
            // If text node, default backspace handles char delete
        } else { // offset === 0, cursor is at the beginning of container
            // Look at the node logically before the container
            let previousNode = container.previousSibling;
            // Skip insignificant whitespace nodes if necessary (though less common with our structure)
            while (previousNode && previousNode.nodeType === Node.TEXT_NODE && !previousNode.textContent.trim()) {
               previousNode = previousNode.previousSibling;
            }
            if (previousNode && previousNode.nodeType === Node.ELEMENT_NODE && previousNode.classList.contains('todo-checkbox')) {
                nodeBeforeCursor = previousNode;
            }
        }
      } catch (e) {
         console.warn("Error checking node before cursor for backspace:", e);
      }

      if (nodeBeforeCursor) {
        // Checkbox found immediately before the cursor
        event.preventDefault(); // Stop default backspace
        nodeBeforeCursor.remove(); // Remove the checkbox

        // Update the store
        setTimeout(() => {
            const sectionTitle = editor.dataset.title;
            const currentContent = editor.innerHTML;
            notes.update(currentNotes =>
                currentNotes.map(note =>
                    note.title === sectionTitle ? { ...note, content: currentContent } : note
                )
            );
        }, 0);
      } else {
        // No checkbox deletion, handle typing state for normal backspace
        handleTypingState();
      }
    } else {
        // Handle typing state for other keys
        handleTypingState();
    }
  }
  // --- End handleKeydown ---

  // Svelte action to initialize the contenteditable element and handle updates safely
  function initContent(node, content) {
    // Set the initial content only if it's different
    // This check prevents unnecessary overwrites and potential flicker on load
    if (node.innerHTML !== content) {
        node.innerHTML = content;
    }

    return {
      update(newContent) {
        // Only update the innerHTML if the element is NOT focused
        // AND if the content has actually changed.
        // This prevents the action from interfering with user typing and direct DOM manipulation.
        if (document.activeElement !== node && node.innerHTML !== newContent) {
            node.innerHTML = newContent;
            // Optional: log when the action updates content
            // console.log("initContent action updated non-focused editor:", node.dataset.title);
        }
      }
      // No destroy needed currently
    };
  }

  // Reactive statement to update mainStyle whenever currentThemeColor changes
  $:
  {
    const hoverColor = hexToRgba(currentThemeColor, 0.16); // Calculate hover color with 16% alpha
    mainStyle = `--theme-color: ${currentThemeColor}; --theme-color-hover: ${hoverColor};`;
    // Also update selection style whenever theme changes
    updateSelectionStyle(currentThemeColor);
  }

  onMount(() => {
    if (!isBrowser) return; // Guard against server-side execution
    
    // --- Initial Countdown Calculation (Content rendering handled by template) ---
    function initializeCountdowns() {
      // Calculate initial countdowns
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

    // Initial call for countdowns
    initializeCountdowns();

    // Interval to update countdowns frequently
    const countdownUpdateInterval = setInterval(() => {
      const now = new Date().getTime();
      const endOfDayMillis = getEndOfDay().getTime();
      dayCountdown = formatTimeDifferenceHMS(endOfDayMillis - now); // Only update day frequently
    }, 1000); // Update every second

    // Interval to update week/quarter less frequently (e.g., every minute)
    const longerInterval = setInterval(() => {
      const now = new Date().getTime();
      const endOfQuarterMillis = getEndOfQuarter(currentYear, currentQuarterNumber);
      quarterCountdown = formatTimeDifferenceDays(endOfQuarterMillis - now);
      const endOfWeekMillis = getEndOfWeek().getTime();
      weekCountdown = formatTimeDifferenceDays(endOfWeekMillis - now);
    }, 60000); // Update every minute

    // --- Quarter Change Check ---
    const quarterCheckInterval = setInterval(() => {
      const now = new Date();
      const newQuarterNumber = getCurrentQuarter();
      const newYear = now.getFullYear();
      const newQuarterKey = getQuarterString(newQuarterNumber, newYear); // e.g., "Q4"

      // Use $notes to read the current store value
      const currentNotesValue = $notes;
      // Find the note that likely holds the quarter data (with title starting with 'Q')
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
          // Recalculate countdowns
          initializeCountdowns(); // Re-init countdowns only
        }
      } else {
        console.warn("Could not find the Quarter note object in the store to check for updates.");
      }
    }, 3600 * 1000); // Check every hour

    // Cleanup timer and intervals on unmount
    return () => {
      clearTimeout(typingTimer);
      clearInterval(quarterCheckInterval); 
      clearInterval(countdownUpdateInterval);
      clearInterval(longerInterval); // Clear the less frequent interval too
      clearTimeout(focusMessageTimeout); // Clear focus message timeout on unmount
      if (selectionStyleElement && selectionStyleElement.parentNode) {
        selectionStyleElement.parentNode.removeChild(selectionStyleElement);
      }
    };
  });
</script>

<main 
  class="flex flex-col items-center min-h-screen w-full pt-8 pb-16 space-y-4" 
  style={mainStyle}
>
  <!-- Iterate over the notes array from the store -->
  {#each $notes as note (note.title)}
    <!-- Section -->
    <section class="w-full max-w-lg px-4">
      <!-- Section Title Row -->
      <h2 class="text-xl font-medium text-gray-500 mb-3 flex items-center space-x-2">
        <span>{note.title}</span>
        <!-- Countdown Pill -->
        {#if /^Q\d$/.test(note.title)}
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
      <!-- Bind the innerHTML to the store content -->
      <!-- NOTE: Using @html directive for initial render to handle saved HTML -->
      <div
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        data-title={note.title}
        class="flex-grow focus:outline-none text-gray-800 editor-area"
        class:typing={isTyping}
        placeholder="Start writing or type [] for a to-do..."
        style="line-height: 1.6;"
        use:initContent={note.content}
        on:input={handleInput} 
        on:keydown={handleKeydown}
        on:click={handleEditorClick}
      ></div>
    </section>
  {/each}

  <!-- Save Indicator -->
  <div
    class="fixed bottom-4 right-4 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full shadow-sm transition-opacity duration-300"
    class:opacity-0={!showSaveIndicator}
    class:opacity-100={showSaveIndicator}
  >
    Saved at {lastSavedText}
  </div>

  <!-- Focus Message Indicator -->
  <div
    class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-md transition-opacity duration-300 ease-in-out"
    class:opacity-0={!showFocusMessage}
    class:opacity-100={showFocusMessage}
    style="background-color: #007AFF; color: white;"
  >
    {focusMessageText}
  </div>
</main>

<style>
  /* Style the contenteditable div like a textarea */
  .editor-area {
    font-size: 1.1rem; 
    white-space: pre-wrap; /* Preserve whitespace and wrap lines */
    word-wrap: break-word; /* Break long words */
    min-height: 80px; /* Min-height per section */
    caret-color: var(--theme-color); 
    border: 1px solid transparent; /* Add border for layout stability during focus */
  }

  /* Add focus style - Temporarily commented out for debugging */
  /* .editor-area:focus {
      border-color: #cbd5e1; 
      outline: none; 
  } */

  /* Temporarily comment out blink animation */
  /* .editor-area:not(.typing) {
    animation: blink 0.75s step-end infinite;
    -webkit-animation: blink 0.75s step-end infinite;
  } */

  /* Placeholder styling for contenteditable div */
  [contenteditable][placeholder]:empty:before {
    content: attr(placeholder);
    color: #a0aec0; /* gray-500 */
    cursor: text;
    pointer-events: none; 
    display: block; /* Needed for placeholder */
  }

  /* Temporarily comment out blink animation keyframes */
  /* @keyframes blink {
    0%, 100% { caret-color: transparent; }
    50% { caret-color: var(--theme-color); }
  } */

  /* @-webkit-keyframes blink {
    0%, 100% { caret-color: transparent; }
    50% { caret-color: var(--theme-color); }
  } */

  /* Countdown Pill Styles */
  .countdown-pill {
    @apply text-xs font-medium px-2 py-0.5 rounded-full inline-block;
    background-color: #f3f4f6; /* gray-100 */
    color: #9ca3af; /* Lighter gray-400 */
    white-space: nowrap; /* Prevent wrapping */
    transition: color 0.3s ease, background-color 0.3s ease;
  }

  /* Specific class for the Today countdown animation & fixed width */
  .today-countdown {
      animation: pulse 2s infinite ease-in-out;
      min-width: 5em; /* Use min-width */
      text-align: center;
      padding-left: 0.5rem;
      padding-right: 0.5rem;
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

  /* Custom styles for the To-Do Checkbox */
  :global(.todo-checkbox) {
    appearance: none;
    -webkit-appearance: none;
    background-color: transparent; 
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--theme-color); 
    border-radius: 0.25rem;
    margin-right: 0.1rem; /* Reduced margin even further */
    cursor: pointer;
    display: inline-block;
    vertical-align: middle; /* Revert for testing jump issue */
    transition: background-color 0.2s ease; /* Add transition for hover */
  }

  /* Style for hover state (only when NOT checked) */
  :global(.todo-checkbox:not(:checked):hover) {
    background-color: var(--theme-color-hover); /* Use the hover variable */
  }

  /* Style for the checked state */
  :global(.todo-checkbox:checked) {
    background-color: var(--theme-color); 
    border-color: var(--theme-color); 
    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
    background-size: 100% 100%;
    background-position: center;
    background-repeat: no-repeat;
  }
</style> 