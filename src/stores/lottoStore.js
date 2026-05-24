import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function currency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(amount || 0));
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed');
  }
  return payload;
}

export const useLottoStore = defineStore('lotto', () => {
  const token = ref(localStorage.getItem('lottomax.token') ?? '');
  const user = ref(null);
  const users = ref([]);
  const groups = ref([]);
  const companyWallet = ref({ balance: 0 });
  const transactions = ref([]);
  const payments = ref([]);
  const activeGroupId = ref('');
  const loading = ref(false);
  const error = ref('');
  const notice = ref('');
  const playerSearch = ref('');
  const selectedPlayerId = ref('');

  const authForm = ref({
    name: 'Ajay',
    email: 'ajay@example.com',
    phone: '+91 90000 00000',
    password: 'ChangeMe123!',
    ageConfirmed: true
  });

  const loginForm = ref({
    email: 'ajay@example.com',
    password: 'ChangeMe123!'
  });

  const paymentForm = ref({
    amount: 1000,
    providerReference: ''
  });

  const pendingPayment = ref(null);
  const playerActionForm = ref({
    accountStatus: 'ACTIVE',
    kycStatus: 'FULL_VERIFIED',
    direction: 'CREDIT',
    amount: 500,
    note: 'Manual owner adjustment'
  });

  const activeGroup = computed(() => (
    groups.value.find((group) => group.id === activeGroupId.value) ?? groups.value[0]
  ));

  const wallet = computed(() => user.value?.wallet?.balance ?? 0);
  const openGroups = computed(() => groups.value.filter((group) => group.status !== 'COMPLETED'));
  const totalPrizePool = computed(() => groups.value.reduce((sum, group) => sum + group.prizePool, 0));
  const groupSizes = computed(() => groups.value.map((group) => group.size).join('-'));
  const you = computed(() => activeGroup.value?.players.find((player) => player.userId === user.value?.id));
  const isOwner = computed(() => user.value?.role === 'OWNER');
  const filteredUsers = computed(() => {
    const term = playerSearch.value.trim().toLowerCase();
    if (!term) return users.value;
    return users.value.filter((item) => [item.name, item.email, item.phone, item.role, item.accountStatus, item.kycStatus]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)));
  });
  const selectedPlayer = computed(() => (
    users.value.find((item) => item.id === selectedPlayerId.value) ?? filteredUsers.value[0] ?? null
  ));

  const availableNumbers = computed(() => {
    const group = activeGroup.value;
    if (!group) return [];
    const taken = new Set(group.players.map((player) => player.number).filter(Boolean));
    return Array.from({ length: group.size }, (_, index) => index + 1).map((number) => ({
      number,
      taken: taken.has(number),
      mine: you.value?.number === number
    }));
  });

  function setMessage(nextNotice = '', nextError = '') {
    notice.value = nextNotice;
    error.value = nextError;
  }

  function commitState(payload) {
    user.value = payload.user ?? user.value;
    users.value = payload.users ?? users.value;
    groups.value = payload.groups ?? groups.value;
    companyWallet.value = payload.companyWallet ?? companyWallet.value;
    transactions.value = payload.transactions ?? transactions.value;
    payments.value = payload.payments ?? payments.value;
    if (!activeGroupId.value && groups.value.length) activeGroupId.value = groups.value[0].id;
    if (!selectedPlayerId.value && users.value.length) selectedPlayerId.value = users.value[0].id;
  }

  async function run(action, successMessage) {
    loading.value = true;
    setMessage();
    try {
      const payload = await action();
      commitState(payload);
      if (successMessage) setMessage(successMessage);
      return payload;
    } catch (err) {
      setMessage('', err.message);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function loadState() {
    if (!token.value) {
      const payload = await request('/api/public-state');
      commitState(payload);
      return payload;
    }
    return run(() => request(`/api/state?token=${encodeURIComponent(token.value)}`));
  }

  async function register() {
    return run(async () => {
      const payload = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(authForm.value)
      });
      token.value = payload.token;
      localStorage.setItem('lottomax.token', token.value);
      return payload;
    }, 'Account created. Wallet is active after payment top-up.');
  }

  async function login() {
    return run(async () => {
      const payload = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm.value)
      });
      token.value = payload.token;
      localStorage.setItem('lottomax.token', token.value);
      return payload;
    }, 'Signed in.');
  }

  function logout() {
    token.value = '';
    user.value = null;
    transactions.value = [];
    payments.value = [];
    localStorage.removeItem('lottomax.token');
    loadState();
  }

  function selectGroup(id) {
    activeGroupId.value = id;
  }

  async function createPaymentOrder() {
    const payload = await run(async () => {
      const payload = await request('/api/payments/orders', {
        method: 'POST',
        body: JSON.stringify({ token: token.value, amount: Number(paymentForm.value.amount) })
      });
      pendingPayment.value = payload.paymentOrder;
      return payload;
    }, 'Razorpay order created.');

    try {
      await openRazorpayCheckout(payload.paymentOrder);
      setMessage('Razorpay payment portal opened.');
    } catch (err) {
      setMessage('Razorpay order created. Checkout could not open automatically; use Reopen Checkout or Capture test payment.', err.message);
    }
    return payload;
  }

  async function confirmPayment(razorpayResponse = null) {
    if (!pendingPayment.value) return;
    return run(async () => {
      const payload = await request('/api/payments/confirm', {
        method: 'POST',
        body: JSON.stringify({
          token: token.value,
          orderId: pendingPayment.value.id,
          providerReference: paymentForm.value.providerReference,
          razorpayPaymentId: razorpayResponse?.razorpay_payment_id,
          razorpayOrderId: razorpayResponse?.razorpay_order_id,
          razorpaySignature: razorpayResponse?.razorpay_signature
        })
      });
      pendingPayment.value = null;
      paymentForm.value.providerReference = '';
      return payload;
    }, 'Razorpay payment verified and wallet credited.');
  }

  function loadRazorpayScript() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Unable to load Razorpay Checkout'));
      document.head.appendChild(script);
    });
  }

  async function openRazorpayCheckout(paymentOrder) {
    if (!paymentOrder?.razorpay) throw new Error('Razorpay order details are missing');
    await loadRazorpayScript();
    const checkout = new window.Razorpay({
      key: paymentOrder.razorpay.keyId,
      amount: paymentOrder.razorpay.amountPaise,
      currency: paymentOrder.razorpay.currency,
      name: paymentOrder.razorpay.name,
      description: paymentOrder.razorpay.description,
      order_id: paymentOrder.razorpay.orderId,
      prefill: {
        name: user.value?.name,
        email: user.value?.email,
        contact: user.value?.phone
      },
      theme: {
        color: '#f5b942'
      },
      handler: (razorpayResponse) => {
        confirmPayment(razorpayResponse);
      },
      modal: {
        ondismiss: () => {
          setMessage('Razorpay checkout closed. You can reopen the payment portal from the pending order.');
        }
      }
    });
    checkout.open();
  }

  async function testCapturePayment() {
    if (!pendingPayment.value) return;
    return run(async () => {
      const payload = await request('/api/payments/test-capture', {
        method: 'POST',
        body: JSON.stringify({
          token: token.value,
          orderId: pendingPayment.value.id
        })
      });
      pendingPayment.value = null;
      return payload;
    }, 'Razorpay test payment captured and wallet credited.');
  }

  async function joinGroup(id) {
    return run(() => request(`/api/groups/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ token: token.value })
    }), 'Entry fee debited into draw escrow.');
  }

  async function pickNumber(number) {
    if (!activeGroup.value) return;
    return run(() => request(`/api/groups/${activeGroup.value.id}/pick`, {
      method: 'POST',
      body: JSON.stringify({ token: token.value, number })
    }), `Number ${number} locked.`);
  }

  async function drawWinner(id) {
    return run(() => request(`/api/groups/${id}/draw`, {
      method: 'POST',
      body: JSON.stringify({ token: token.value })
    }), 'Draw settled by backend ledger.');
  }

  function selectPlayer(id) {
    selectedPlayerId.value = id;
    const player = users.value.find((item) => item.id === id);
    if (player) {
      playerActionForm.value.accountStatus = player.accountStatus ?? 'ACTIVE';
      playerActionForm.value.kycStatus = player.kycStatus ?? 'BASIC_VERIFIED';
    }
  }

  async function updatePlayerStatus() {
    if (!selectedPlayer.value) return;
    return run(() => request(`/api/users/${selectedPlayer.value.id}/status`, {
      method: 'POST',
      body: JSON.stringify({ token: token.value, accountStatus: playerActionForm.value.accountStatus })
    }), 'Player account status updated.');
  }

  async function updatePlayerKyc() {
    if (!selectedPlayer.value) return;
    return run(() => request(`/api/users/${selectedPlayer.value.id}/kyc`, {
      method: 'POST',
      body: JSON.stringify({ token: token.value, kycStatus: playerActionForm.value.kycStatus })
    }), 'Player KYC status updated.');
  }

  async function adjustPlayerWallet() {
    if (!selectedPlayer.value) return;
    return run(() => request(`/api/users/${selectedPlayer.value.id}/wallet-adjustments`, {
      method: 'POST',
      body: JSON.stringify({
        token: token.value,
        direction: playerActionForm.value.direction,
        amount: Number(playerActionForm.value.amount),
        note: playerActionForm.value.note
      })
    }), 'Player wallet adjustment applied.');
  }

  async function addPlayerNote() {
    if (!selectedPlayer.value) return;
    return run(() => request(`/api/users/${selectedPlayer.value.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ token: token.value, note: playerActionForm.value.note })
    }), 'Player note added.');
  }

  return {
    token,
    user,
    users,
    groups,
    companyWallet,
    transactions,
    payments,
    activeGroupId,
    activeGroup,
    openGroups,
    totalPrizePool,
    groupSizes,
    wallet,
    you,
    isOwner,
    playerSearch,
    selectedPlayerId,
    selectedPlayer,
    filteredUsers,
    availableNumbers,
    authForm,
    loginForm,
    paymentForm,
    pendingPayment,
    playerActionForm,
    loading,
    error,
    notice,
    currency,
    loadState,
    register,
    login,
    logout,
    selectGroup,
    createPaymentOrder,
    confirmPayment,
    openRazorpayCheckout,
    testCapturePayment,
    joinGroup,
    pickNumber,
    drawWinner,
    selectPlayer,
    updatePlayerStatus,
    updatePlayerKyc,
    adjustPlayerWallet,
    addPlayerNote
  };
});
