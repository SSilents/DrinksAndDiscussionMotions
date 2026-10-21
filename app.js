import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ygorhjelejuagliaiaza.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kcwuUmWcvxR0YNxpyse5XQ_w-FspC0F";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const motionForm = document.querySelector("#motion-form");
const formStatus = document.querySelector("#form-status");
const motionsList = document.querySelector("#motions-list");
const motionsStatus = document.querySelector("#motions-status");
const motionSort = document.querySelector("#motion-sort");
const refreshButton = document.querySelector("#refresh-motions");
const adminAuthButton = document.querySelector("#admin-auth");
const adminStatus = document.querySelector("#admin-status");
const adminMotions = document.querySelector("#admin-motions");
const proposerInput = document.querySelector("#motion-proposer");
const anonymousInput = document.querySelector("#motion-anonymous");

const escapeHtml = (value) => {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
};

const formatDate = (date) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
}).format(new Date(date));

const setStatus = (element, message, isError = false) => {
  element.textContent = message;
  element.classList.toggle("error", isError);
};

function updateAnonymousField() {
  proposerInput.disabled = anonymousInput.checked;
  proposerInput.placeholder = anonymousInput.checked ? "Displayed as Anonymous" : "";
  if (anonymousInput.checked) proposerInput.value = "";
}

async function ensureAnonymousSession() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

async function loadMotions() {
  setStatus(motionsStatus, "Loading motions...");
  const { data: motions, error } = await supabase
    .from("motions")
    .select("id, title, proposer, is_anonymous, supporting_argument, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(motionsStatus, `Could not load motions: ${error.message}`, true);
    return;
  }

  if (!motions.length) {
    setStatus(motionsStatus, "No motions yet. Be the first to submit one!");
    motionsList.replaceChildren();
    return;
  }

  const motionIds = motions.map(({ id }) => id);
  const { data: reactions, error: reactionsError } = await supabase
    .from("motion_reactions")
    .select("motion_id, vote")
    .in("motion_id", motionIds);

  if (reactionsError) {
    setStatus(motionsStatus, `Could not load reactions: ${reactionsError.message}`, true);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const { data: interests, error: interestsError } = await supabase
    .from("motion_interests")
    .select("motion_id, user_id")
    .in("motion_id", motionIds);

  if (interestsError) {
    setStatus(motionsStatus, `Could not load debate interest: ${interestsError.message}`, true);
    return;
  }

  const counts = reactions.reduce((result, reaction) => {
    const current = result[reaction.motion_id] ?? { up: 0, down: 0 };
    current[reaction.vote === 1 ? "up" : "down"] += 1;
    result[reaction.motion_id] = current;
    return result;
  }, {});
  const interestCounts = interests.reduce((result, interest) => {
    result[interest.motion_id] = (result[interest.motion_id] ?? 0) + 1;
    return result;
  }, {});
  const interestedMotionIds = new Set(
    interests
      .filter(({ user_id }) => user_id === session?.user?.id)
      .map(({ motion_id }) => String(motion_id)),
  );

  const sortOrder = motionSort.value;
  const sortedMotions = [...motions].sort((first, second) => {
    if (sortOrder === "newest") return 0;

    const firstCount = sortOrder === "interest"
      ? interestCounts[first.id] ?? 0
      : counts[first.id]?.[sortOrder === "for" ? "up" : "down"] ?? 0;
    const secondCount = sortOrder === "interest"
      ? interestCounts[second.id] ?? 0
      : counts[second.id]?.[sortOrder === "for" ? "up" : "down"] ?? 0;
    return secondCount - firstCount;
  });

  motionsList.innerHTML = sortedMotions.map((item) => {
    const count = counts[item.id] ?? { up: 0, down: 0 };
    const interestCount = interestCounts[item.id] ?? 0;
    const isInterested = interestedMotionIds.has(String(item.id));
    return `
      <article class="motion-card">
        <h3>${escapeHtml(item.title)}</h3>
        <p class="motion-meta">Proposed by ${item.is_anonymous ? "Anonymous" : escapeHtml(item.proposer)} · ${formatDate(item.created_at)}</p>
        <p class="supporting-argument">${escapeHtml(item.supporting_argument)}</p>
        <div class="reaction-controls" data-motion-id="${item.id}">
          <button class="reaction-button" type="button" data-vote="1" aria-label="Vote for ${escapeHtml(item.title)}">For <span>${count.up}</span></button>
          <button class="reaction-button" type="button" data-vote="-1" aria-label="Vote against ${escapeHtml(item.title)}">Against <span>${count.down}</span></button>
        </div>
        <button class="interest-button${isInterested ? " is-interested" : ""}" type="button" data-interest-motion="${item.id}" aria-pressed="${isInterested}">
          ${isInterested ? "Interested in debating this" : "I'm interested in debating this"} <span>${interestCount}</span>
        </button>
      </article>
    `;
  }).join("");
  setStatus(motionsStatus, `${motions.length} motion${motions.length === 1 ? "" : "s"}`);
}

async function loadAdminPanel() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (adminError) {
    setStatus(adminStatus, `Could not check admin access: ${adminError.message}`, true);
    return;
  }

  adminAuthButton.textContent = "Sign out";
  if (!admin) {
    setStatus(adminStatus, "Signed in, but this account is not an administrator.");
    return;
  }

  setStatus(adminStatus, "Administrator access enabled.");
  adminMotions.hidden = false;
  const { data: motions, error } = await supabase
    .from("motions")
    .select("id, title, proposer, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(adminStatus, `Could not load admin controls: ${error.message}`, true);
    return;
  }

  adminMotions.innerHTML = motions.map((item) => `
    <div class="admin-motion-row">
      <span>${escapeHtml(item.title)} — ${escapeHtml(item.proposer)}</span>
      <button class="delete-button" type="button" data-delete-motion="${item.id}">Delete</button>
    </div>
  `).join("");
}

adminAuthButton.addEventListener("click", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.auth.signOut();
    adminMotions.hidden = true;
    adminMotions.replaceChildren();
    adminAuthButton.textContent = "Sign in with GitHub";
    setStatus(adminStatus, "Signed out.");
    return;
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: window.location.href },
  });
  if (error) setStatus(adminStatus, `Could not start GitHub sign-in: ${error.message}`, true);
});

adminMotions.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-motion]");
  if (!button || !window.confirm("Delete this motion? This cannot be undone.")) return;
  button.disabled = true;
  const { error } = await supabase.from("motions").delete().eq("id", button.dataset.deleteMotion);
  if (error) {
    setStatus(adminStatus, `Could not delete motion: ${error.message}`, true);
    button.disabled = false;
    return;
  }
  await loadMotions();
  await loadAdminPanel();
});

motionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = motionForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  setStatus(formStatus, "Publishing...");

  try {
    const session = await ensureAnonymousSession();
    const formData = new FormData(motionForm);
    const isAnonymous = formData.get("anonymous") === "on";
    const proposer = String(formData.get("proposer") ?? "").trim();
    if (!isAnonymous && !proposer) {
      throw new Error("Enter your name or choose Submit anonymously.");
    }
    const { error } = await supabase.from("motions").insert({
      author_id: session.user.id,
      title: String(formData.get("title") ?? "").trim(),
      proposer: isAnonymous ? "Anonymous" : proposer,
      is_anonymous: isAnonymous,
      supporting_argument: String(formData.get("supporting_argument") ?? "").trim(),
    });
    if (error) throw error;
    motionForm.reset();
    setStatus(formStatus, "Motion published.");
    await loadMotions();
  } catch (error) {
    setStatus(formStatus, `Could not publish motion: ${error.message}`, true);
  } finally {
    submitButton.disabled = false;
  }
});

motionsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-vote]");
  const interestButton = event.target.closest("[data-interest-motion]");
  if (!button && !interestButton) return;
  const clickedButton = button ?? interestButton;
  clickedButton.disabled = true;

  try {
    const session = await ensureAnonymousSession();
    const motionId = button
      ? button.closest("[data-motion-id]").dataset.motionId
      : interestButton.dataset.interestMotion;
    let error;
    if (button) {
      ({ error } = await supabase.from("motion_reactions").upsert({
        motion_id: motionId,
        user_id: session.user.id,
        vote: Number(button.dataset.vote),
      }, { onConflict: "motion_id,user_id" }));
    } else {
      const isInterested = interestButton.getAttribute("aria-pressed") === "true";
      if (isInterested) {
        ({ error } = await supabase
          .from("motion_interests")
          .delete()
          .eq("motion_id", motionId)
          .eq("user_id", session.user.id));
      } else {
        ({ error } = await supabase.from("motion_interests").insert({
          motion_id: motionId,
          user_id: session.user.id,
        }));
      }
    }
    if (error) throw error;
    await loadMotions();
  } catch (error) {
    setStatus(motionsStatus, `Could not save response: ${error.message}`, true);
  } finally {
    clickedButton.disabled = false;
  }
});

refreshButton.addEventListener("click", loadMotions);
motionSort.addEventListener("change", loadMotions);
anonymousInput.addEventListener("change", updateAnonymousField);
supabase.auth.onAuthStateChange(() => loadAdminPanel());
updateAnonymousField();
loadMotions();
loadAdminPanel();
