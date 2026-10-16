# Junta as exportações da Hotmart (.xls/.xlsx) num CSV que a tela "Importar contatos" entende.
# Só leva nome, e-mail, telefone, cidade, estado, Instagram e a compra (sem CPF e sem endereço).
# Uso: python3 scripts/converter_hotmart.py saida.csv arquivo1.xls arquivo2.xls ...
import sys, csv, re, collections, warnings, openpyxl
warnings.filterwarnings('ignore')
saida, arquivos = sys.argv[1], sys.argv[2:]
COLS = ['Código da transação', 'Status da transação', 'Data da transação', 'Produto', 'Comprador(a)', 'Email do(a) Comprador(a)', 'Telefone', 'Cidade', 'Estado / Província', 'Instagram', 'Produtor(a)']
vistos = {}; por_ano = collections.Counter(); st = collections.Counter(); prod = collections.Counter()
for a in arquivos:
    ws = openpyxl.load_workbook(open(a, 'rb'), read_only=True).worksheets[0]
    it = ws.iter_rows(values_only=True); hdr = next(it); ix = {h: i for i, h in enumerate(hdr)}
    for r in it:
        if not r or not r[ix['Código da transação']]: continue
        lin = {c: ('' if ix.get(c) is None or r[ix[c]] is None else str(r[ix[c]]).strip()) for c in COLS}
        vistos[lin['Código da transação']] = lin
for lin in vistos.values():
    por_ano[lin['Data da transação'][6:10]] += 1; st[lin['Status da transação']] += 1; prod[lin['Produtor(a)']] += 1
with open(saida, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=COLS, delimiter=';'); w.writeheader(); w.writerows(vistos.values())
pes = {}
for l in vistos.values():
    e = l['Email do(a) Comprador(a)'].lower(); t = re.sub(r'\D', '', l['Telefone'])
    pes.setdefault(e, set())
    if len(t) >= 10: pes[e].add(t)
print('vendas', len(vistos), 'pessoas', len(pes), 'com telefone', sum(1 for v in pes.values() if v))
print('por ano', sorted(por_ano.items())); print('status', st.most_common()); print('conta', prod.most_common())
