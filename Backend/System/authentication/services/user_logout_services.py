

def logout(user):
   profile = user.profile
   profile.is_online = False
   profile.save()