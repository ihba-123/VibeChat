from cryptography.fernet import Fernet
from decouple import config

fernet = Fernet(config('FERNET_KEY').encode())# encode --> convert the key to byte

def message_encrypt(message:str)->str:
  return fernet.encrypt(message.encode()).decode()

def message_decode(message:str)->str:
  return fernet.decrypt(message.encode()).decode()