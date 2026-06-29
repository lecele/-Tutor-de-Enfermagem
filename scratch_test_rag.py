import urllib.request
import json
import time

URL_LOCAL = "http://localhost:3000/api/chat"

TESTS = [
    {
        "name": "1. Teste de Saudacao (Menu)",
        "message": "Olá, sou estudante e quero iniciar os estudos."
    },
    {
        "name": "2. Teste Tecnico (Busca no RAG + Resposta Socratica)",
        "message": "Quais os principais cuidados de enfermagem na sala de recuperação anestésica (SRPA)?"
    },
    {
        "name": "3. Teste de Fallback (Fora do Escopo)",
        "message": "Como trocar o pneu de um carro?"
    }
]

def run_tests():
    print("=" * 60)
    print("INICIANDO SUITE DE TESTES DO TUTOR DE ENFERMAGEM (RAG)")
    print("=" * 60)
    
    for t in TESTS:
        print(f"\n{t['name']}")
        print(f"Mensagem: \"{t['message']}\"")
        
        payload = {
            "session_id": "test-session-9999",
            "message": t["message"]
        }
        
        req = urllib.request.Request(
            URL_LOCAL,
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        
        t_start = time.time()
        try:
            with urllib.request.urlopen(req) as response:
                t_elapsed = time.time() - t_start
                data = json.loads(response.read().decode('utf-8'))
                
                print(f"Status: SUCCESS | Tempo de Resposta: {t_elapsed:.2f}s")
                print(f"Fontes encontradas (RAG): {data.get('sources_found', 0)}")
                print("-" * 40)
                print(data.get("answer"))
                print("-" * 40)
        except Exception as e:
            t_elapsed = time.time() - t_start
            print(f"Status: FAILED | Tempo de Resposta: {t_elapsed:.2f}s")
            print(f"Erro: {e}")
            
    print("\n" + "=" * 60)
    print("FIM DOS TESTES")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
