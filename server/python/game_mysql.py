import mysql.connector
from mysql.connector import Error

# Global MySQL connection variable
def game_mysql_connect():

	# Create connection to our MySQL Database
	try:
		game_mysql_conn = mysql.connector.connect(host='localhost', database='db_games', user='george', password='raspberry')
		
		if game_mysql_conn.is_connected():
			return game_mysql_conn
		else:
			return False

	except Error as e:
		# Error creating connection
		print(e)
		return False;

def game_mysql_update(query, args):

	# Connect to MySQL first
	game_mysql_conn = game_mysql_connect()

	# If successful we can run our query
	if game_mysql_conn:

		try:
			game_mysql_cursor = game_mysql_conn.cursor(dictionary=True, buffered=True)
			game_mysql_cursor.execute(query, args)
			game_mysql_conn.commit()
			return True

		except Error as e:
			print(e)
			return False;

		finally:
			# Finally, close the cursor if it was created
			try: game_mysql_cursor
			except NameError: game_mysql_cursor = None
			
			if game_mysql_cursor != None:
				game_mysql_cursor.close()

			# Close MySQL connection
			game_mysql_conn.close()

	else:
		return False

def game_mysql_multi_update(query, args):
	
	# Connect to MySQL first
	game_mysql_conn = game_mysql_connect()

	# If successful we can run our query
	if game_mysql_conn:
		try:
			game_mysql_cursor = game_mysql_conn.cursor(dictionary=True, buffered=True)
			multi_query = game_mysql_cursor.execute(query, args, multi=True)
			for result in multi_query:
				print('cursor:', result.lastrowid)

			game_mysql_conn.commit()
			return True

		except Error as e:
			print(e)
			return False;

		finally:
			# Finally, close the cursor if it was created
			try: game_mysql_cursor
			except NameError: game_mysql_cursor = None
			if game_mysql_cursor != None:
				game_mysql_cursor.close()

			# Close MySQL connection
			game_mysql_conn.close()

	else:
		return False

def game_mysql_insert(query, args):
	
	# Connect to MySQL first
	game_mysql_conn = game_mysql_connect()

	# If successful we can run our query
	if game_mysql_conn:
		try:
			game_mysql_cursor = game_mysql_conn.cursor(dictionary=True, buffered=True)
			game_mysql_cursor.execute(query, args)
			
			if game_mysql_cursor.lastrowid:
				game_mysql_conn.commit()
				return game_mysql_cursor.lastrowid
			else:
				return False


		except Error as e:
			print(e)
			return False;

		finally:
			# Finally, close the cursor if it was created
			try: game_mysql_cursor
			except NameError: game_mysql_cursor = None
			if game_mysql_cursor != None:
				game_mysql_cursor.close()

			# Close MySQL connection
			game_mysql_conn.close()

	else:
		return False

def game_mysql_select(query, args):
	
	# Connect to MySQL first
	game_mysql_conn = game_mysql_connect()

	# If successful we can run our query
	if game_mysql_conn:
		try:
			game_mysql_cursor = game_mysql_conn.cursor(dictionary=True, buffered=True)
			game_mysql_cursor.execute(query, args)
			num_rows = game_mysql_cursor.rowcount

			rows = game_mysql_cursor.fetchall()
			return num_rows, rows

		except Error as e:
			print(e)
			return -1, False;

		finally:
			# Finally, close the cursor if it was created
			try: game_mysql_cursor
			except NameError: game_mysql_cursor = None
			if game_mysql_cursor != None:
				game_mysql_cursor.close()

			# Close MySQL connection
			game_mysql_conn.close()

	else:
		return -1, False