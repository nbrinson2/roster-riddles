package com.rosterriddles.rosterriddles.utils.login;

import java.util.List;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;

public class UserPasswords {

	final static Logger logger = LoggerFactory.getLogger(UserPasswords.class);
	
	public class UserPassword {
		private int id;
		private int userId;
		private String password;
		private Timestamp updated;
		
		public UserPassword() {
			super();
		}
		public UserPassword(int id, int user_id, String password, Timestamp updated) {
			super();
			this.id = id;
			this.userId = user_id;
			this.password = password;
			this.updated = updated;
		}
		public int getId() {
			return id;
		}
		public void setId(int id) {
			this.id = id;
		}
		public int getUserId() {
			return userId;
		}
		public void setUserId(int user_id) {
			this.userId = user_id;
		}
		public String getPassword() {
			return password;
		}
		public void setPassword(String password) {
			this.password = password;
		}
		public Timestamp getUpdated() {
			return updated;
		}
		public void setUpdated(Timestamp updated) {
			this.updated = updated;
		}
	}
	
	public class SortByUpdated implements Comparator<UserPassword>
	{
	    // Used for sorting in ascending order of timestamp
	    public int compare(UserPassword a, UserPassword b)
	    {
	        return (int) (a.getUpdated().getTime() - b.getUpdated().getTime());
	    }
	}

	public List<UserPassword> getUserPasswords(int user_id, EntityManager em) {
		String query = "select " + " up.id, up.user_id, up.password, up.update_time " +
				" from sportsbiz.password_user up" + " where up.user_id=:userId ";
		Query data = em.createNativeQuery(query);
		data.setParameter("userId", user_id);
		List<Object[]> response = data.getResultList();
		logger.debug("getUserPasswords.size:" + response.size());
        List<UserPassword> values = new ArrayList<UserPassword>();

        for (Object[] db : response) {
			logger.debug("getPasswordId:" + (int) db[0]);
			logger.debug("getUserPasswords:" + (String) db[2]);
			UserPassword pass = new UserPassword();
			pass.setId((int) db[0]);
			pass.setUserId((int) db[1]);
			pass.setPassword((String) db[2]);
			pass.setUpdated((Timestamp) db[3]);
			values.add(pass);
		}
		logger.debug("passwords", values.toString());
		return values;
	}
	

	public void updateUserPasswords(int user_id, String pass, List<UserPassword> currentPasswords, EntityManager em)
			throws Exception {
		if (currentPasswords.size() >= 4) {
			logger.debug("currentPasswordsSize=" + currentPasswords.size());
			List<UserPassword> sortCurrentPasswords = new ArrayList<UserPassword>(currentPasswords);
			Collections.sort(sortCurrentPasswords, new SortByUpdated());
			deletePassword(sortCurrentPasswords.get(0).getId(), em);
			sortCurrentPasswords.stream().forEach(up -> {
				logger.debug("time=" + up.getUpdated());
			});
		}
		addPassword(user_id, pass, em);
	}

	private void deletePassword(int pass_id, EntityManager em) throws Exception {
		String query = "delete from sportsbiz.password_user where id=:id";
		logger.debug("query=" + query);
		logger.debug("passId=" + pass_id);		
		Query data = em.createNativeQuery(query);
		data.setParameter("id", pass_id);
		data.executeUpdate();
	}

	private void addPassword(int user_id, String pass, EntityManager em) throws Exception {
		String query = "insert into sportsbiz.password_user (user_id, password) values (:userId,:password)";
		logger.debug("query=" + query);
		logger.debug("userId=" + user_id);
		Query data = em.createNativeQuery(query);
		data.setParameter("userId", user_id);
		data.setParameter("password", pass);
		data.executeUpdate();
	}
}
