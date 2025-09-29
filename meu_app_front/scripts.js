const API = 'http://localhost:5000';

function showView(view) {
    if (view === 'categorias') renderCategorias();
    if (view === 'gastos') renderGastos();
    if (view === 'dashboard') renderDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
    showView('dashboard');
});

// --- Categorias ---
async function renderCategorias() {
    const app = document.getElementById('app');
    // Busca categorias para sugerir ordem
    const res = await fetch(`${API}/categorias`);
    const data = await res.json();
    const categorias = data.categorias;
    const maiorOrdem = Math.max(0, ...categorias.map(c => c.ordem || 0));
    const sugestaoOrdem = maiorOrdem + 1;
    app.innerHTML = `<h2>Categorias</h2>
        <form id="form-categoria">
            <label>Nome da categoria</label>
            <input type="text" name="nome" required>
            <label>Ordem</label>
            <input type="number" name="ordem" min="1" value="${sugestaoOrdem}" required>
            <button type="submit">Adicionar</button>
        </form>
        <div class="list" id="categorias-list"></div>`;

    document.getElementById('form-categoria').onsubmit = async (e) => {
        e.preventDefault();
        const nome = e.target.nome.value.trim();
        let ordemStr = e.target.ordem.value.trim();
        let ordem = ordemStr === '' ? undefined : Number(ordemStr);
        if (!nome || ordem === undefined || isNaN(ordem)) return;
        // Se ordem for menor que sugestao, atualiza as outras
        if (ordem < sugestaoOrdem) {
            // Reordena categorias
            let novasCategorias = categorias.map(c => {
                if (c.ordem >= ordem) {
                    return { ...c, ordem: c.ordem + 1 };
                }
                return c;
            });
            // Atualiza backend
            for (const cat of novasCategorias) {
                await fetch(`${API}/categorias/${cat.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ordem: cat.ordem })
                });
            }
        }
        // Adiciona nova categoria via FormData com timeout
        const formData = new FormData();
        formData.append('nome', nome);
        formData.append('ordem', ordem);
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 3000);
        let erroTimeout = false;
        try {
            await fetch(`${API}/categorias`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
        } catch (err) {
            erroTimeout = true;
        } finally {
            clearTimeout(timeout);
        }
        if (erroTimeout) {
            alert('A operação foi abortada por timeout (3 segundos) sem resposta do servidor. Tente novamente.');
            return;
        }
        renderCategorias();
    };
    const list = document.getElementById('categorias-list');
    list.innerHTML = `<table><tr><th>Nome</th><th>Ordem</th><th>Ações</th></tr>${categorias.map(c => `<tr><td>${c.nome}</td><td>${c.ordem ?? '-'}
    </td><td>
        <button onclick="editCategoria('${c.id}')">Editar</button>
        <button onclick="deleteCategoria('${c.id}')">Excluir</button>
        <button onclick="viewCategoria('${c.id}')">Detalhes</button>
    </td></tr>`).join('')}</table>`;

}

async function editCategoria(id) {
    const res = await fetch(`${API}/categorias/${id}`);
    const categoria = (await res.json());
    showModal(`<h3>Editar Categoria</h3>
        <form id='edit-categoria-form'>
            <label>Nome</label>
            <input name='nome' value='${categoria.nome}' required>
            <label>Ordem</label>
            <input name='ordem' value='${categoria.ordem ?? ''}'>
            <button type='submit'>Salvar</button>
            <button type='button' onclick='closeModal()'>Cancelar</button>
        </form>`);
    document.getElementById('edit-categoria-form').onsubmit = async (e) => {
        e.preventDefault();
        const nome = e.target.nome.value;
        let ordemStr = e.target.ordem.value.trim();
        let ordem = ordemStr === '' ? undefined : Number(ordemStr);
        if (!nome || ordem === undefined || isNaN(ordem)) return;
        const formData = new FormData();
        formData.append('nome', nome);
        formData.append('ordem', ordem);
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 3000);
        let erroTimeout = false;
        try {
            await fetch(`${API}/categorias/${id}`, {
                method: 'PUT',
                body: formData,
                signal: controller.signal
            });
        } catch (err) {
            erroTimeout = true;
        } finally {
            clearTimeout(timeout);
        }
        if (erroTimeout) {
            alert('A operação foi abortada por timeout (3 segundos) sem resposta do servidor. Tente novamente.');
            return;
        }
        closeModal();
        renderCategorias();
    };
}

async function deleteCategoria(id) {
    if (!confirm('Confirma exclusão da categoria?')) return;
    await fetch(`${API}/categoria/${id}`, { method: 'DELETE' });
    renderCategorias();
}

async function viewCategoria(id) {
    const res = await fetch(`${API}/categorias/${id}`);
    const categoria = (await res.json());
    showModal(`<h3>Detalhes da Categoria</h3>
        <p><strong>Nome:</strong> ${categoria.nome}</p>
        <p><strong>Ordem:</strong> ${categoria.ordem ?? '-'}</p>
        <button onclick='closeModal()'>Fechar</button>`);
}

// --- Gastos ---
async function renderGastos() {
    const app = document.getElementById('app');
    const categoriasRes = await fetch(`${API}/categorias`);
    const categorias = (await categoriasRes.json()).categorias;
    app.innerHTML = `<h2>Gastos</h2>
        <form id="form-gasto">
            <label>Descrição</label>
            <input type="text" name="descricao" required>
            <label>Valor (R$)</label>
            <input type="number" name="valor" step="0.01" required>
            <label>Categoria</label>
            <select name="categoria_id" required>
                ${categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
            </select>
            <label>Data do gasto</label>
            <input type="datetime-local" name="data_gasto">
            <button type="submit">Adicionar</button>
        </form>
        <div class="list" id="gastos-list"></div>`;

    document.getElementById('form-gasto').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const descricao = form.descricao.value.trim();
        const valor = parseFloat(form.valor.value);
        const categoria_id = form.categoria_id.value;
        let data_gasto = form.data_gasto.value;
        // Converte para ISO se informado
        if (data_gasto) {
            // data_gasto vem como 'YYYY-MM-DDTHH:mm', converte para ISO
            data_gasto = new Date(data_gasto).toISOString();
        } else {
            data_gasto = '';
        }
        const formData = new FormData();
        formData.append('descricao', descricao);
        formData.append('valor', valor);
        formData.append('categoria_id', categoria_id);
        formData.append('data_gasto', data_gasto);
        const controller = new AbortController();
        const timeout = setTimeout(() => { controller.abort(); }, 3000);
        let erroTimeout = false;
        try {
            await fetch(`${API}/gastos`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
        } catch (err) {
            erroTimeout = true;
        } finally {
            clearTimeout(timeout);
        }
        if (erroTimeout) {
            alert('A operação foi abortada por timeout (3 segundos) sem resposta do servidor. Tente novamente.');
            return;
        }
        renderGastos();
    };
    const res = await fetch(`${API}/gastos`);
    const data = await res.json();
    const list = document.getElementById('gastos-list');
    list.innerHTML = `<table><tr><th>Descrição</th><th>Valor</th><th>Categoria</th><th>Data</th><th>Ações</th></tr>${data.gastos.map(g => {
        let dataFormatada = '-';
        if (g.data_gasto) {
            // Exibe no formato brasileiro
            dataFormatada = g.data_gasto.replace('T', ' ');
        }
        return `<tr><td>${g.descricao}</td><td>R$ ${g.valor.toFixed(2)}</td><td>${g.categoria_obj?.nome ?? '-'}
        </td><td>${dataFormatada}
        </td><td>
            <button onclick="editGasto('${g.id}')">Editar</button>
            <button onclick="deleteGasto('${g.id}')">Excluir</button>
            <button onclick="viewGasto('${g.id}')">Detalhes</button>
        </td></tr>`;
    }).join('')}</table>`;
}

async function editGasto(id) {
    const res = await fetch(`${API}/gastos/${id}`);
    const gasto = (await res.json());
    const categoriasRes = await fetch(`${API}/categorias`);
    const categorias = (await categoriasRes.json()).categorias;
    // Converte data_gasto para yyyy-MM-dd
    let dataValue = '';
    if (gasto.data_gasto) {
        // Aceita formato 'aaaa-MM-dd HH:mm:ss' e converte para 'YYYY-MM-DDTHH:mm' para o input
        let dtStr = gasto.data_gasto.replace(' ', 'T');
        // Remove segundos se existirem
        dtStr = dtStr.length > 16 ? dtStr.substring(0,16) : dtStr;
        dataValue = dtStr;
    }
    showModal(`<h3>Editar Gasto</h3>
        <form id='edit-gasto-form'>
            <label>Descrição</label>
            <input name='descricao' value='${gasto.descricao}' required>
            <label>Valor</label>
            <input name='valor' type='number' step='0.01' value='${gasto.valor}' required>
            <label>Categoria</label>
            <select name='categoria_id'>
                ${categorias.map(c => `<option value='${c.id}' ${c.id===gasto.categoria_id?'selected':''}>${c.nome}</option>`).join('')}
            </select>
            <label>Data do gasto</label>
            <input name='data_gasto' type='datetime-local' value='${dataValue}'>
            <button type='submit'>Salvar</button>
            <button type='button' onclick='closeModal()'>Cancelar</button>
        </form>`);
    document.getElementById('edit-gasto-form').onsubmit = async (e) => {
        e.preventDefault();
        const descricao = e.target.descricao.value;
        const valor = parseFloat(e.target.valor.value);
        const categoria_id = e.target.categoria_id.value;
        let data_gasto = e.target.data_gasto.value;
        if (data_gasto) {
            data_gasto = new Date(data_gasto).toISOString();
        } else {
            data_gasto = '';
        }
        const formData = new FormData();
        formData.append('descricao', descricao);
        formData.append('valor', valor);
        formData.append('categoria_id', categoria_id);
        formData.append('data_gasto', data_gasto);
        const controller = new AbortController();
        const timeout = setTimeout(() => { controller.abort(); }, 3000);
        let erroTimeout = false;
        try {
            await fetch(`${API}/gastos/${id}`, {
                method: 'PUT',
                body: formData,
                signal: controller.signal
            });
        } catch (err) {
            erroTimeout = true;
        } finally {
            clearTimeout(timeout);
        }
        if (erroTimeout) {
            alert('A operação foi abortada por timeout (3 segundos) sem resposta do servidor. Tente novamente.');
            return;
        }
        closeModal();
        renderGastos();
    };
}

async function deleteGasto(id) {
    if (!confirm('Confirma exclusão do gasto?')) return;
    await fetch(`${API}/gasto/${id}`, { method: 'DELETE' });
    renderGastos();
}

async function viewGasto(id) {
    const res = await fetch(`${API}/gastos/${id}`);
    const gasto = (await res.json());
    showModal(`<h3>Detalhes do Gasto</h3>
        <p><strong>Descrição:</strong> ${gasto.descricao}</p>
        <p><strong>Valor:</strong> R$ ${gasto.valor.toFixed(2)}</p>
        <p><strong>Categoria:</strong> ${gasto.categoria_obj?.nome ?? '-'}</p>
        <p><strong>Data:</strong> ${gasto.data_gasto ? new Date(gasto.data_gasto).toLocaleDateString() : '-'}</p>
        <button onclick='closeModal()'>Fechar</button>`);
}
// Modal helpers
function showModal(html) {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    if (!modal || !content) {
        alert('Erro interno: modal não encontrado.');
        return;
    }
    content.innerHTML = html;
    modal.style.display = 'flex';
}
function closeModal() {
    const modal = document.getElementById('modal');
    modal.style.display = 'none';
}

// --- Dashboard ---
async function renderDashboard() {
    const app = document.getElementById('app');
    // Elementos para filtros e refresh
    let lastRefresh = new Date();
    let gastosData = window._gastosData || null;
    let categoriasData = window._categoriasData || null;
    async function fetchData() {
        const resGastos = await fetch(`${API}/gastos`);
        const resCategorias = await fetch(`${API}/categorias`);
        const gastos = (await resGastos.json()).gastos;
        const categorias = (await resCategorias.json()).categorias;
        window._gastosData = gastos;
        window._categoriasData = categorias;
        return { gastos, categorias };
    }

    async function renderAllDashboard() {
        // Se não tem dados, busca
        if (!gastosData || !categoriasData) {
            const d = await fetchData();
            gastosData = d.gastos;
            categoriasData = d.categorias;
        }
        // Filtros
        const uniqueAnos = [...new Set(gastosData.map(g => g.data_gasto ? g.data_gasto.substring(0,4) : '').filter(Boolean))];
        // Persistência dos filtros
        window._dashboardFiltroCategoria = window._dashboardFiltroCategoria || '';
        window._dashboardFiltroAno = window._dashboardFiltroAno || '';
        window._dashboardFiltroMes = window._dashboardFiltroMes || '';
        let filtroCategoria = window._dashboardFiltroCategoria;
        let filtroAno = window._dashboardFiltroAno;
        let filtroMes = window._dashboardFiltroMes;
        // Filtra gastos para meses disponíveis
        let gastosParaMes = gastosData.filter(g => {
            let ok = true;
            if (filtroCategoria && String(g.categoria_id) !== String(filtroCategoria)) ok = false;
            if (filtroAno && (!g.data_gasto || g.data_gasto.substring(0,4) !== filtroAno)) ok = false;
            return ok;
        });
        const uniqueMeses = [...new Set(gastosParaMes.map(g => g.data_gasto ? g.data_gasto.substring(5,7) : '').filter(Boolean))];
        const categoriaOptions = categoriasData.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        // Filtros selecionados
    // Persistência dos filtros já movida acima
        // Filtra gastos
        let gastosFiltrados = gastosData.filter(g => {
            let ok = true;
            // Compara categoria pelo id do objeto retornado
            if (filtroCategoria && (!g.categoria_obj || String(g.categoria_obj.id) !== String(filtroCategoria))) ok = false;
            if (filtroAno && (!g.data_gasto || g.data_gasto.substring(0,4) !== filtroAno)) ok = false;
            if (filtroMes && (!g.data_gasto || g.data_gasto.substring(5,7) !== filtroMes)) ok = false;
            return ok;
        });
        // Fallback de depuração: se filtroCategoria está ativo e não há gastos, mostra aviso
        if (filtroCategoria && gastosFiltrados.length === 0) {
            document.getElementById('totals').innerHTML = `<div style='color:red'>Nenhum gasto encontrado para a categoria selecionada.</div>`;
        }
        // Totais por mês e ano
        const porMes = {};
        const porAno = {};
        let total = 0;
        gastosFiltrados.forEach(g => {
            const dt = g.data_gasto ? new Date(g.data_gasto.replace(' ', 'T')) : null;
            if (!dt) return;
            const mes = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
            const ano = dt.getFullYear();
            porMes[mes] = (porMes[mes] || 0) + g.valor;
            porAno[ano] = (porAno[ano] || 0) + g.valor;
            total += g.valor;
        });
        // Renderiza dashboard
        app.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h2>Dashboard</h2>
                <div style="font-size:0.95rem;color:#888;">Último refresh: ${lastRefresh.toLocaleString('pt-BR')}</div>
            </div>
            <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap;">
                <label>Categoria</label>
                <select id="filtro-categoria"><option value="">Todas</option>${categoriaOptions}</select>
                <label>Ano</label>
                <select id="filtro-ano"><option value="">Todos</option>${uniqueAnos.map(a => `<option value="${a}">${a}</option>`).join('')}</select>
                <label>Mês</label>
                <select id="filtro-mes"><option value="">Todos</option>${uniqueMeses.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
                <button id="refresh-dashboard">Refresh</button>
            </div>
            <div class="totals" id="totals"></div>
            <canvas id="chart-mes" height="120"></canvas>
            <canvas id="chart-ano" height="120"></canvas>
        `;
        document.getElementById('refresh-dashboard').onclick = async () => {
            lastRefresh = new Date();
            gastosData = null;
            categoriasData = null;
            await renderAllDashboard();
        };
        document.getElementById('filtro-categoria').value = filtroCategoria;
        document.getElementById('filtro-ano').value = filtroAno;
        document.getElementById('filtro-mes').value = filtroMes;
        document.getElementById('filtro-categoria').onchange = function() {
            window._dashboardFiltroCategoria = this.value;
            // Reset mês se não disponível
            if (!uniqueMeses.includes(window._dashboardFiltroMes)) {
                window._dashboardFiltroMes = '';
            }
            renderAllDashboard();
        };
        document.getElementById('filtro-ano').onchange = function() {
            window._dashboardFiltroAno = this.value;
            // Reset mês se não disponível
            if (!uniqueMeses.includes(window._dashboardFiltroMes)) {
                window._dashboardFiltroMes = '';
            }
            renderAllDashboard();
        };
        document.getElementById('filtro-mes').onchange = function() {
            window._dashboardFiltroMes = this.value;
            renderAllDashboard();
        };
        // Totais ajustados conforme solicitado
        // Total Geral: sempre o total de todos os gastos filtrados apenas por categoria
        let totalGeral = gastosData
            .filter(g => !filtroCategoria || (g.categoria_obj && String(g.categoria_obj.id) === String(filtroCategoria)))
            .reduce((a, g) => a + g.valor, 0);

        // Total Ano: total do ano selecionado (desconsidera mês)
        let totalAno = 0;
        if (filtroAno) {
            totalAno = gastosData
                .filter(g => (!filtroCategoria || (g.categoria_obj && String(g.categoria_obj.id) === String(filtroCategoria))) && g.data_gasto && g.data_gasto.substring(0,4) === filtroAno)
                .reduce((a, g) => a + g.valor, 0);
        }

        // Total Mês: lógica ajustada conforme solicitado
        let totalMes = 0;
        if (filtroAno && filtroMes) {
            // Ano e mês selecionados
            totalMes = gastosData
                .filter(g => (!filtroCategoria || (g.categoria_obj && String(g.categoria_obj.id) === String(filtroCategoria))) && g.data_gasto && g.data_gasto.substring(0,4) === filtroAno && g.data_gasto.substring(5,7) === filtroMes)
                .reduce((a, g) => a + g.valor, 0);
        } else if (filtroAno && !filtroMes) {
            // Ano selecionado, mês = Todos
            totalMes = gastosData
                .filter(g => (!filtroCategoria || (g.categoria_obj && String(g.categoria_obj.id) === String(filtroCategoria))) && g.data_gasto && g.data_gasto.substring(0,4) === filtroAno)
                .reduce((a, g) => a + g.valor, 0);
        } else if (!filtroAno && !filtroMes) {
            // Ano = Todos, mês = Todos
            totalMes = gastosData
                .filter(g => (!filtroCategoria || (g.categoria_obj && String(g.categoria_obj.id) === String(filtroCategoria))))
                .reduce((a, g) => a + g.valor, 0);
        }

        document.getElementById('totals').innerHTML = `
            <div class="card">Total Geral<br><strong>R$ ${totalGeral.toFixed(2)}</strong></div>
            <div class="card">Total Ano<br><strong>R$ ${totalAno.toFixed(2)}</strong></div>
            <div class="card">Total Mês<br><strong>R$ ${totalMes.toFixed(2)}</strong></div>
        `;
        // Gráfico por mês
        const ctxMes = document.getElementById('chart-mes').getContext('2d');
        new Chart(ctxMes, {
            type: 'bar',
            data: {
                labels: Object.keys(porMes),
                datasets: [{
                    label: 'Total por Mês',
                    data: Object.values(porMes),
                    backgroundColor: '#2d6cdf',
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
        // Gráfico por ano
        const ctxAno = document.getElementById('chart-ano').getContext('2d');
        new Chart(ctxAno, {
            type: 'line',
            data: {
                labels: Object.keys(porAno),
                datasets: [{
                    label: 'Total por Ano',
                    data: Object.values(porAno),
                    borderColor: '#2d6cdf',
                    backgroundColor: 'rgba(45,108,223,0.1)',
                    fill: true
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
    renderAllDashboard();
}
