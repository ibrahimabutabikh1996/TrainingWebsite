/* The last answer to "is the Christmas effect on?", kept in the browser so the
 * loading screens can dress up without waiting for the server. SeasonalLayer
 * writes it on every visit; a first-ever visit has nothing here yet and gets
 * the plain loading screen. */

const KEY = "xmas-effect";

export function rememberSeason(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Storage blocked (private mode, policy): the loading screen stays plain.
  }
}

export function recallSeason(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
