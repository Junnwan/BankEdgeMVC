from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

# Create the extension objects
db = SQLAlchemy()
bcrypt = Bcrypt()